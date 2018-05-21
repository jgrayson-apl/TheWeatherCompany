/**
 *
 * WeatherTileLayer
 *  - The Weather Company Tiled Layer
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  5/15/2018 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/config",
  "dojo/date",
  "esri/geometry/support/scaleUtils",
  "esri/layers/WebTileLayer"
], function (esriConfig, date, scaleUtils, WebTileLayer) {

  const WeatherTileLayer = WebTileLayer.createSubclass({
    declaredClass: "WeatherTileLayer",

    properties: {
      apiKey: {
        type: String,
        value: null
      },
      copyright: {
        type: String,
        value: "The Weather Company"
      },
      base_url: {
        type: String,
        value: "api.weather.com"
      },
      is_CORS: {
        type: Boolean,
        value: true
      },
      layer_name: {
        type: String,
        value: null,
        set: function (value) {
          this._set("layer_name", value);
          this.is_forcast = value.endsWith("Fcst");
        }
      },
      is_forcast: {
        type: Boolean,
        value: false
      },
      update_frequency: {
        type: Number,
        value: 5.0
      },
      ts: {
        type: Number,
        value: null,
        set: function (value) {
          this._set("ts", value);
          this.urlTemplate = this.getCurrentURLTemplate();
        }
      },
      fts: {
        type: Number,
        value: null,
        set: function (value) {
          this._set("fts", value);
          this.urlTemplate = this.getCurrentURLTemplate();
        }
      },
      urlTemplate: {
        type: String,
        dependsOn: ["base_url", "layer_name", "ts", "apiKey"],
        set: function (value) {
          this._set("urlTemplate", value);
          this.refresh();
        }
      },
      legendEnabled: {
        type: Boolean,
        value: false
      },
      nativeZoom: {
        aliasOf: "layer_info.nativeZoom"
      },
      layer_info: {
        type: Object,
        value: null,
        set: function (value) {
          this._set("layer_info", value);
          this.maxScale = this.tileInfo.zoomToScale(value.maxZoom);

          const layer_series = value.series;
          const latest_series = layer_series[0];

          if(this.is_forcast) {
            this.ts = latest_series.ts;
            this.series = latest_series.fts.reverse();
            this.fts = this.series[0];
          } else {
            this.series = layer_series.reverse();
            this.ts = this.series[0].ts;
          }

        }
      },
      series: {
        type: Array,
        value: null
      }
    },

    /**
     *
     */
    constructor: function () {
      if(this.is_CORS) {
        // CORS ENABLED SERVER //
        esriConfig.request.corsEnabledServers.push(this.base_url);
      }
    },

    /**
     *
     * @returns {string}
     */
    getCurrentURLTemplate: function () {
      if(this.is_forcast) {
        return `https://${this.base_url}/v3/TileServer/tile/${this.layer_name}?ts=${this.ts}&fts=${this.fts}&xyz={col}:{row}:{level}&apiKey=${this.apiKey}`;
      } else {
        return `https://${this.base_url}/v3/TileServer/tile/${this.layer_name}?ts=${this.ts}&xyz={col}:{row}:{level}&apiKey=${this.apiKey}`;
      }
    },

    /**
     *
     * @param index
     */
    setTimestampIndex: function (index) {
      if(index < this.series.length) {
        const series = this.series[index];
        if(this.is_forcast) {
          this.fts = series;
        } else {
          this.ts = series.ts;
        }
      }
    }

  });

  WeatherTileLayer.version = "0.0.1";

  return WeatherTileLayer;
});