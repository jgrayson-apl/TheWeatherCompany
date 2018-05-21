/**
 *
 * WeatherInventorySeries
 *  - The Weather Company Inventory Series
 *    https://docs.google.com/document/d/1RTRj9QE76MGMBI3KRHggGI3LYbIhg7wiiSOqL2YTkEU/edit#
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  5/15/2018 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/config",
  "esri/request",
  "Application/WeatherTileLayer"
], function (Accessor, Evented, esriConfig, esriRequest, WeatherTileLayer) {


  // WEATHER LAYER NAMES TO TITLES //
  const WEATHER_LAYER_TITLES = {
    "sat": "Satellite",
    "ussat": "US Satellite",
    "dewpoint": "Dewpoint",
    "feelsLike": "Feels Like",
    "precip24hr": "Precipitation 24 Hour",
    "rwi": "Road Weather Index",
    "satrad": "Satellite & Radar",
    "snow24hr": "Snow 24 Hour",
    "temp": "Temperature",
    "tempChange": "Temperature Change",
    "uv": "UltraViolet (UV)",
    "windSpeed": "Wind Speed",
    "radar": "Radar",
    "radarAustralian": "Radar Australia",
    "radarEurope": "Radar Europe",
    "euVisSat": "Europe - Visible Spectrum",
    "euIrSat": "Europe - Longwave  Infrared",
    "cloudsFcst": "Clouds Forecast",
    "dewpointFcst": "Dew Point Forecast",
    "feelsLikeFcst": "Feels Like Forecast",
    "precip24hrFcst": "Precipitation 24 Hour Forecast",
    "radarFcst": "Radar Forecast",
    "satradFcst": "Satellite & Radar Forecast",
    "snow24hrFcst": "Snow 24 Hour Forecast",
    "tempFcst": "Temperature Forecast",
    "uvFcst": "UltraViolet (UV) Forecast",
    "windSpeedFcst": "Wind Speed Forecast"
  };

  const WeatherInventorySeries = Accessor.createSubclass([Evented], {
    declaredClass: "WeatherInventorySeries",

    properties: {
      apiKey: {
        type: String,
        dependsOn: ["base_url"],
        value: null,
        set: function (value) {
          this._set("apiKey", value);
          this.getSeriesInfo();
        }
      },
      is_CORS: {
        type: Boolean,
        value: true
      },
      base_url: {
        type: String,
        value: "api.weather.com"
      },
      layer_infos: {
        type: Map,
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
     *  https://api.weather.com/v3/TileServer/series?apiKey=01b24e6727ee491fb24e6727eec91f36
     */
    getSeriesInfo: function () {

      esriRequest(`https://${this.base_url}/v3/TileServer/series/productSet/PPAcore`, {
        callbackParamName: "cb",
        query: {
          apiKey: this.apiKey
        }
      }).then((series_response) => {

        const _layer_infos = new Map();
        Object.keys(series_response.data.seriesInfo).forEach(layer_name => {
          if(WEATHER_LAYER_TITLES.hasOwnProperty(layer_name)) {
            const series_info = series_response.data.seriesInfo[layer_name];
            series_info.name = layer_name;
            series_info.title = WEATHER_LAYER_TITLES[layer_name] || layer_name;
            _layer_infos.set(layer_name, series_info);
          }
        });

        // SET LAYER INFOS //
        this.layer_infos = _layer_infos;

        console.info("WeatherInventorySeries.seriesInfos: ", this.layer_infos);
      }).otherwise(error => {
        console.error("WeatherInventorySeries.seriesInfos: ", error);
      });

    },

    /**
     *
     * @param layer_name
     * @returns {*}
     */
    getWeatherLayer: function (layer_name) {

      // LAYER INFO //
      const layer_info = this.layer_infos.get(layer_name);
      if(layer_info) {

        // WEATHER LAYER //
        return new WeatherTileLayer({
          apiKey: this.apiKey,
          title: layer_info.title,
          layer_name: layer_info.name,
          layer_info: layer_info
        });

      } else {
        console.error(new Error(`Can't generate Weather Layer '${layer_name}'...`));
        return null;
      }

    },

    /**
     *
     * @param layer_name
     */
    getWeatherLegend: function (layer_name) {
      /*...*/
    }

  });

  WeatherInventorySeries.version = "0.0.1";

  return WeatherInventorySeries;
});