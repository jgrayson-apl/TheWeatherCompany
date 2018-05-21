/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/on",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-construct",
  "dojo/date",
  "dojo/date/locale",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/config",
  "esri/request",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/layers/Layer",
  "esri/layers/GroupLayer",
  "esri/layers/WebTileLayer",
  "esri/geometry/Extent",
  "esri/widgets/Feature",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "Application/WeatherInventorySeries"
], function (calcite, declare, ApplicationBase, i18n, itemUtils, domHelper,
             on, query, dom, domClass, domConstruct, date, locale,
             IdentityManager, Evented, esriConfig, esriRequest, watchUtils, promiseUtils, Portal, Layer, GroupLayer, WebTileLayer, Extent,
             Feature, Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand,
             WeatherInventorySeries) {

  return declare([Evented], {

    /**
     *
     */
    constructor: function () {
      this.CSS = {
        loading: "configurable-application--loading",
        NOTIFICATION_TYPE: {
          MESSAGE: "alert alert-blue animate-in-up is-active inline-block",
          SUCCESS: "alert alert-green animate-in-up is-active inline-block",
          WARNING: "alert alert-yellow animate-in-up is-active inline-block",
          ERROR: "alert alert-red animate-in-up is-active inline-block"
        },
      };
      this.base = null;
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function (base) {
      if(!base) {
        console.error("ApplicationBase is not defined");
        return;
      }
      domHelper.setPageLocale(base.locale);
      domHelper.setPageDirection(base.direction);

      this.base = base;
      const config = base.config;
      const results = base.results;
      const find = config.find;
      const marker = config.marker;

      const allMapAndSceneItems = results.webMapItems.concat(results.webSceneItems);
      const validMapItems = allMapAndSceneItems.map(function (response) {
        return response.value;
      });

      const firstItem = validMapItems[0];
      if(!firstItem) {
        console.error("Could not load an item to display");
        return;
      }
      config.title = (config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(config.title);

      const viewProperties = itemUtils.getConfigViewProperties(config);
      viewProperties.container = "view-container";

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then((map) => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then((view) => {
          itemUtils.findQuery(find, view).then(() => {
            itemUtils.goToMarker(marker, view).then(() => {
              domClass.remove(document.body, this.CSS.loading);
              this.viewReady(config, firstItem, view);
            });
          });
        });
      });
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function (config, item, view) {

      // TITLE //
      dom.byId("app-title-node").innerHTML = config.title;

      // MAP DETAILS //
      this.displayMapDetails(item);

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updating_node, "is-active", updating);
      });

      // PANEL TOGGLE //
      if(query(".pane-toggle-target").length > 0) {
        const panelToggleBtn = domConstruct.create("div", { className: "panel-toggle icon-ui-left-triangle-arrow icon-ui-flush font-size-1", title: "Toggle Left Panel" }, view.root);
        on(panelToggleBtn, "click", () => {
          domClass.toggle(panelToggleBtn, "icon-ui-left-triangle-arrow icon-ui-right-triangle-arrow");
          query(".pane-toggle-target").toggleClass("hide");
          query(".pane-toggle-source").toggleClass("column-18 column-24");
        });
      }

      // USER SIGN IN //
      this.initializeUserSignIn(view).always(() => {

        // POPUP DOCKING OPTIONS //
        view.popup.dockEnabled = true;
        view.popup.dockOptions = {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-center"
        };

        // SEARCH //
        const search = new Search({ view: view, searchTerm: this.base.config.search || "" });
        view.ui.add(search, { position: "top-left", index: 0 });

        // HOME //
        const homeWidget = new Home({ view: view });
        view.ui.add(homeWidget, { position: "top-left", index: 1 });

        // BASEMAPS //
        const basemapGalleryExpand = new Expand({
          view: view,
          content: new BasemapGallery({ view: view }),
          expandIconClass: "esri-icon-basemap",
          expandTooltip: "Basemap"
        });
        view.ui.add(basemapGalleryExpand, { position: "top-left", index: 4 });

        // MAP VIEW ONLY //
        if(view.type === "2d") {
          // SNAP TO ZOOM //
          view.constraints.snapToZoom = false;

          // COMPASS //
          const compass = new Compass({ view: view });
          view.ui.add(compass, { position: "top-left", index: 5 });

          // PRINT //
          const print = new Print({
            view: view,
            printServiceUrl: (config.helperServices.printTask.url || this.base.portal.helperServices.printTask.url),
            templateOptions: { title: config.title, author: this.base.portal.user ? this.base.portal.user.fullName : "" }
          }, "print-node");
          this.updatePrintOptions = (title, author, copyright) => {
            print.templateOptions.title = title;
            print.templateOptions.author = author;
            print.templateOptions.copyright = copyright;
          };
          this.on("portal-user-change", () => {
            this.updatePrintOptions(config.title, this.base.portal.user ? this.base.portal.user.fullName : "");
          });
        } else {
          domClass.add("print-action-node", "hide");
        }

        // PLACES //
        this.initializePlaces(view);

        //
        // LAYER LIST //
        //
        // CREATE OPACITY NODE //
        const createOpacityNode = (item, parent_node) => {
          const opacity_node = domConstruct.create("div", { className: "opacity-node esri-widget", title: "Layer Opacity" }, parent_node);
          // domConstruct.create("span", { className: "font-size--3", innerHTML: "Opacity:" }, opacity_node);
          const opacity_input = domConstruct.create("input", { className: "opacity-input", type: "range", min: 0, max: 1.0, value: item.layer.opacity, step: 0.01 }, opacity_node);
          on(opacity_input, "input", () => {
            item.layer.opacity = opacity_input.valueAsNumber;
          });
          item.layer.watch("opacity", (opacity) => {
            opacity_input.valueAsNumber = opacity;
          });
          opacity_input.valueAsNumber = item.layer.opacity;
          return opacity_node;
        };
        // CREATE TOOLS NODE //
        const createToolsNode = (item, parent_node) => {
          // TOOLS NODE //
          const tools_node = domConstruct.create("div", { className: "opacity-node esri-widget" }, parent_node);

          // REORDER //
          const reorder_node = domConstruct.create("div", { className: "inline-block" }, tools_node);
          const reorder_up_node = domConstruct.create("button", { className: "btn-link esri-icon-arrow-up", title: "Move layer up..." }, reorder_node);
          const reorder_down_node = domConstruct.create("button", { className: "btn-link esri-icon-arrow-down", title: "Move layer down..." }, reorder_node);
          on(reorder_up_node, "click", () => {
            view.map.reorder(item.layer, view.map.layers.indexOf(item.layer) + 1);
          });
          on(reorder_down_node, "click", () => {
            view.map.reorder(item.layer, view.map.layers.indexOf(item.layer) - 1);
          });

          // REMOVE LAYER //
          const remove_layer_node = domConstruct.create("button", { className: "btn-link icon-ui-close right", title: "Remove layer from map..." }, tools_node);
          on.once(remove_layer_node, "click", () => {
            view.map.remove(item.layer);
            this.emit("layer-removed", item.layer);
          });

          // ZOOM TO //
          const zoom_to_node = domConstruct.create("button", { className: "btn-link icon-ui-zoom-in-magnifying-glass right", title: "Zoom to Layer" }, tools_node);
          on(zoom_to_node, "click", () => {
            view.goTo(item.layer.fullExtent);
          });

          // LAYER DETAILS //
          if(item.layer.portalItem) {
            const itemDetailsPageUrl = `${this.base.portal.url}/home/item.html?id=${item.layer.portalItem.id}`;
            domConstruct.create("a", { className: "btn-link icon-ui-description icon-ui-blue right", title: "View details...", target: "_blank", href: itemDetailsPageUrl }, tools_node);
          }

          return tools_node;
        };

        // LAYER LIST //
        const layerList = new LayerList({
          container: "layer-list-container",
          view: view,
          listItemCreatedFunction: (evt) => {
            let item = evt.item;
            if(item.layer) {

              // CREATE ITEM PANEL //
              const panel_node = domConstruct.create("div", { className: "esri-widget" });

              // LAYER TOOLS //
              createToolsNode(item, panel_node);

              // OPACITY //
              createOpacityNode(item, panel_node);

              if(item.layer.declaredClass === "WeatherTileLayer") {
                this.createWeatherPanel(view, item.layer, panel_node);
              }

              // LEGEND //
              if(item.layer.legendEnabled) {
                const legend = new Legend({ container: panel_node, view: view, layerInfos: [{ layer: item.layer }] })
              }

              // SET ITEM PANEL //
              item.panel = {
                title: "Settings",
                className: "esri-icon-settings",
                content: panel_node
              };

            }
          }
        });
        //view.ui.add(layerList, { position: "top-right", index: 0 });

        // WEATHER //
        this.initializeWeather(view);

      });

    },

    /**
     * DISPLAY MAP DETAILS
     *
     * @param portalItem
     */
    displayMapDetails: function (portalItem) {

      const itemLastModifiedDate = (new Date(portalItem.modified)).toLocaleString();

      dom.byId("current-map-card-thumb").src = portalItem.thumbnailUrl;
      dom.byId("current-map-card-thumb").alt = portalItem.title;
      dom.byId("current-map-card-caption").innerHTML = `A map by ${portalItem.owner}`;
      dom.byId("current-map-card-caption").title = "Last modified on " + itemLastModifiedDate;
      dom.byId("current-map-card-title").innerHTML = portalItem.title;
      dom.byId("current-map-card-title").href = `https://www.arcgis.com/home/item.html?id=${portalItem.id}`;
      dom.byId("current-map-card-description").innerHTML = portalItem.description;

    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function (view) {

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn);
      };
      IdentityManager.on("credential-create", checkSignInStatus);
      IdentityManager.on("credential-destroy", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = dom.byId("sign-in-node");
      const userNode = dom.byId("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user) {
          dom.byId("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.base.portal.user.username;
          dom.byId("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");
        } else {
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);

      };

      // USER SIGN IN //
      on(signInNode, "click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = dom.byId("sign-out-node");
      if(signOutNode) {
        on(signOutNode, "click", userSignOut);
      }

      return checkSignInStatus();
    },

    /**
     *
     * @param view
     */
    initializePlaces: function (view) {

      // WEB SCENE //
      if(view.map.presentation && view.map.presentation.slides && (view.map.presentation.slides.length > 0)) {
        // PLACES PANEL //
        const placesPanel = domConstruct.create("div", { className: "places-panel panel panel-no-padding esri-widget" });
        const placesExpand = new Expand({
          view: view,
          content: placesPanel,
          expandIconClass: "esri-icon-applications",
          expandTooltip: "Places"
        }, domConstruct.create("div"));
        view.ui.add(placesExpand, "bottom-left");

        // SLIDES //
        const slides = view.map.presentation.slides;
        slides.forEach((slide) => {

          const slideNode = domConstruct.create("div", { className: "places-node esri-interactive" }, placesPanel);
          domConstruct.create("img", { className: "", src: slide.thumbnail.url }, slideNode);
          domConstruct.create("span", { className: "places-label", innerHTML: slide.title.text }, slideNode);

          on(slideNode, "click", () => {
            slide.applyTo(view, {
              animate: true,
              speedFactor: 0.33,
              easing: "in-out-cubic"   // linear, in-cubic, out-cubic, in-out-cubic, in-expo, out-expo, in-out-expo
            }).then(() => {
              placesExpand.collapse();
            });
          });
        });

        view.on("layerview-create", (evt) => {
          if(evt.layer.visible) {
            slides.forEach((slide) => {
              slide.visibleLayers.add({ id: evt.layer.id });
            });
          }
        });
      } else {
        // WEB MAP //
        if(view.map.bookmarks && view.map.bookmarks.length > 0) {

          // PLACES DROPDOWN //
          const placesDropdown = domConstruct.create("div", { className: "dropdown js-dropdown esri-widget" });
          view.ui.add(placesDropdown, { position: "top-left", index: 1 });
          const placesBtn = domConstruct.create("button", {
            className: "btn btn-transparent dropdown-btn js-dropdown-toggle",
            "tabindex": "0", "aria-haspopup": "true", "aria-expanded": "false",
            innerHTML: "Places"
          }, placesDropdown);
          domConstruct.create("span", { className: "icon-ui-down" }, placesBtn);
          // MENU //
          const placesMenu = domConstruct.create("nav", { className: "dropdown-menu modifier-class" }, placesDropdown);

          // BOOKMARKS //
          view.map.bookmarks.forEach((bookmark) => {
            // MENU ITEM //
            const bookmarkNode = domConstruct.create("div", {
              className: "dropdown-link",
              role: "menu-item",
              innerHTML: bookmark.name
            }, placesMenu);
            on(bookmarkNode, "click", () => {
              view.goTo({ target: Extent.fromJSON(bookmark.extent) });
            });
          });

          // INITIALIZE CALCITE DROPDOWN //
          calcite.dropdown();
        }
      }

    },

    /**
     *
     * @param layer
     * @param error
     */
    addLayerNotification: function (layer, error) {
      const notificationsNode = dom.byId("notifications-node");

      const alertNode = domConstruct.create("div", {
        className: error ? this.CSS.NOTIFICATION_TYPE.ERROR : this.CSS.NOTIFICATION_TYPE.SUCCESS
      }, notificationsNode);

      const alertCloseNode = domConstruct.create("div", { className: "inline-block esri-interactive icon-ui-close margin-left-1 right" }, alertNode);
      on.once(alertCloseNode, "click", () => {
        domConstruct.destroy(alertNode);
      });

      domConstruct.create("div", { innerHTML: error ? error.message : `Layer '${layer.title}' added to map...` }, alertNode);

      if(error) {
        if(layer.portalItem) {
          const itemDetailsPageUrl = `${this.base.portal.url}/home/item.html?id=${layer.portalItem.id}`;
          domConstruct.create("a", { innerHTML: "view item details", target: "_blank", href: itemDetailsPageUrl }, alertNode);
        }
      } else {
        setTimeout(() => {
          domClass.toggle(alertNode, "animate-in-up animate-out-up");
          setTimeout(() => {
            domConstruct.destroy(alertNode);
          }, 500)
        }, 4000);
      }
    },

    /**
     *
     * @param view
     */
    initializeWeather: function (view) {

      // TITLE //
      const titleNode = domConstruct.create("div", { className: "panel esri-widget esri-interactive", title: "The Weather Company" });
      domConstruct.create("img", { className: "title-img-node", src: "./assets/TheWeatherCompany.png" }, titleNode);
      view.ui.add(titleNode, { position: "top-left", index: 0 });
      on(titleNode, "click", () => {
        window.open("http://www.theweathercompany.com/")
      });

      // ESRI WEATHER API KEY //
      const WEATHER_API_KEY = "01b24e6727ee491fb24e6727eec91f36";

      // WEATHER INVENTORY //
      const weather_inventory = new WeatherInventorySeries({ apiKey: WEATHER_API_KEY });
      watchUtils.whenDefined(weather_inventory, "layer_infos", (layer_infos) => {
        if(layer_infos) {

          // CREATE WEATHER LAYER SELECT OPTIONS //
          const weather_layer_select = dom.byId("weather-layers-select");
          layer_infos.forEach((layer_info) => {
            domConstruct.create("option", {
              value: layer_info.name,
              innerHTML: layer_info.title
            }, weather_layer_select);
          });

          // CREATE LAYER //
          const add_weather_layer_btn = dom.byId("add-weather-layer-btn");
          on(add_weather_layer_btn, "click", () => {
            // LAYER NAME //
            const layer_name = weather_layer_select.value;

            // CREATE WEATHER LAYER //
            const weather_layer = weather_inventory.getWeatherLayer(layer_name);
            if(weather_layer) {
              // GO TO WEATHER LAYER NATIVE ZOOM BEFORE ADDING TO MAP //
              // view.goTo({ zoom: weather_layer.nativeZoom }).then(() => {
              // ADD WEATHER LAYER TO MAP //
              view.map.add(weather_layer);
              // });
            } else {

            }

          });
          domClass.toggle(add_weather_layer_btn, "btn-disabled", (layer_infos.size === 0));

        } else {
          /*...*/
        }
      });

    },

    /**
     *
     * @param view
     * @param weather_layer
     * @param panel_node
     */
    createWeatherPanel: function (view, weather_layer, panel_node) {

      // WEATHER LAYER TIME SERIES //
      const series = weather_layer.series;
      const last_series = (series.length - 1);

      // TIME NODE //
      const time_panel = domConstruct.create("div", { className: "panel padding-leader-quarter padding-trailer-quarter" }, panel_node);
      const time_node = domConstruct.create("div", { className: "time-input-group input-group esri-widget" }, time_panel);
      const time_play = domConstruct.create("span", { className: "input-group-button esri-icon-play esri-icon-green esri-interactive" }, time_node);
      const time_input = domConstruct.create("input", { className: "input-group-input padding-left-1 padding-right-1", type: "range", min: 0, max: last_series, value: last_series }, time_node);
      const time_label = domConstruct.create("div", { className: "text-center font-size--3" }, time_panel);

      const setTimeLabel = () => {
        const series_value = weather_layer.is_forcast ? +series[time_input.valueAsNumber] : +series[time_input.valueAsNumber].ts;
        const timestamp = new Date(series_value * 1000);
        time_label.innerHTML = locale.format(timestamp, {});
      };
      setTimeLabel();

      const time_change = () => {
        setTimeLabel();
        weather_layer.setTimestampIndex(time_input.valueAsNumber);
      };

      on(time_input, "input", setTimeLabel);
      on(time_input, "change", time_change);

      let play_interval = null;
      on(time_play, "click", () => {
        play_interval && clearInterval(play_interval);

        domClass.toggle(time_play, "esri-icon-play esri-icon-pause esri-icon-red");
        domClass.toggle(time_input, "btn-disabled");
        if(domClass.contains(time_play, "esri-icon-pause")) {

          time_input.stepUp();
          time_change();

          play_interval = setInterval(() => {
            if(time_input.valueAsNumber === +time_input.max) {
              time_input.valueAsNumber = +time_input.min;
            } else {
              time_input.stepUp();
            }
            time_change();
          }, 2000);
        }
      });

      this.on("layer-removed", (layer) => {
        if(layer.id === weather_layer.id) {
          play_interval && clearInterval(play_interval);
        }
      });

    }

  });
});