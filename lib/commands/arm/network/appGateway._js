/**
 * Copyright (c) Microsoft.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var __ = require('underscore');
var constants = require('./constants');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var Subnet = require('./subnet');

function AppGateways(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
  this.subnetCrud = new Subnet(cli, networkResourceProviderClient);
}

__.extend(AppGateways.prototype, {
  get: function (resourceGroup, appGatewayName, _) {
    var self = this;
    var appGateway;
    var progress = self.interaction.progress(util.format($('Looking up an Application Gateway "%s"'), appGatewayName));
    try {
      appGateway = self.networkResourceProviderClient.applicationGateways.get(resourceGroup, appGatewayName, _);
    } catch (error) {
      if (error.code === 'ResourceNotFound' || error.code === 'NotFound') {
        appGateway = null;
      } else {
        throw error;
      }
    } finally {
      progress.end();
    }

    return appGateway;
  },

  show: function (resourceGroup, appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);

    if (appGateway) {
      self._showAppGateway(appGateway);
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('An Application Gateway with name "%s" not found in resource group "%s"'),
          appGatewayName, resourceGroup));
      }
    }
  },

  listAll: function (_) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up subscription Application Gateways')));
    var appGateways;
    try {
      appGateways = self.networkResourceProviderClient.applicationGateways.listAll(_);
    } finally {
      progress.end();
    }

    if (!appGateways) {
      output.warn(util.format($('No application gateways found in resource group "%s"'), resourceGroup));
    }

    self.interaction.formatOutput(appGateways.applicationGateways, function (data) {
      if (data.length === 0) {
        self.output.warn(util.format($('No application gateways found in subscription')));
      } else {
        self.output.table(data, function (row, gateway) {
          row.cell($('Name'), gateway.name);
          row.cell($('Provisioning state'), gateway.provisioningState);
          row.cell($('Location'), gateway.location);
          row.cell($('Resource group'), self._getResourceGroup(gateway));
        });
      }
    });
  },

  list: function (resourceGroup, options, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up Application Gateways in resource group "%s"'),
      resourceGroup));
    var appGateways;
    try {
      appGateways = self.networkResourceProviderClient.applicationGateways.list(resourceGroup, _);
    } finally {
      progress.end();
    }

    if (!appGateways) {
      output.warn(util.format($('No application gateways found in resource group "%s"'), resourceGroup));
    }

    self.interaction.formatOutput(appGateways.applicationGateways, function (data) {
      if (data.length === 0) {
        self.output.warn(util.format($('No application gateways found in resource group "%s"'), resourceGroup));
      } else {
        self.output.table(data, function (row, gateway) {
          row.cell($('Name'), gateway.name);
          row.cell($('Provisioning state'), gateway.provisioningState);
          row.cell($('Location'), gateway.location);
        });
      }
    });
  },

  start: function (resourceGroup, appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      self.output.warn(util.format($('An Application Gateway with name "%s" not found in resource group "%s"'),
        appGatewayName, resourceGroup));
      return;
    }
    var progress = self.interaction.progress(util.format($('Starting an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkResourceProviderClient.applicationGateways.start(resourceGroup, appGatewayName, _);
    } finally {
      progress.end();
    }
  },

  stop: function (resourceGroup, appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      self.output.warn(util.format($('An Application Gateway with name "%s" not found in resource group "%s"'),
        appGatewayName, resourceGroup));
      return;
    }
    var progress = self.interaction.progress(util.format($('Stopping an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkResourceProviderClient.applicationGateways.stop(resourceGroup, appGatewayName, _);
    } finally {
      progress.end();
    }
  },

  addHttpSettings: function (resourceGroup, appGatewayName, httpSettingsName, options, _) {
    var self = this;
    var httpSettings = self._parseHttpSettings(httpSettingsName, options, true);
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (appGateway) {
      appGateway = appGateway.applicationGateway;
      var settings = utils.findFirstCaseIgnore(appGateway.backendHttpSettingsCollection, {name: httpSettingsName});
      if (settings) {
        throw new Error(util.format($('A http settings with name "%s" already exists for an Application Gateway "%s"'), httpSettingsName, appGatewayName));
      } else {
        appGateway.backendHttpSettingsCollection.push(httpSettings);
        self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
        self.show(resourceGroup, appGatewayName, options, _);
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
    }
  },

  removeHttpSettings: function (resourceGroup, appGatewayName, httpSettingsName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (appGateway) {
      appGateway = appGateway.applicationGateway;
      var index = utils.indexOfCaseIgnore(appGateway.backendHttpSettingsCollection, {name: httpSettingsName});
      if (index !== -1) {
        if (!options.quiet && !self.interaction.confirm(util.format($('Delete an http settings "%s"? [y/n] '), httpSettingsName), _)) {
          return;
        }
        appGateway.backendHttpSettingsCollection.splice(index, 1);
        self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
        self.show(resourceGroup, appGatewayName, options, _);
      } else {
        throw new Error(util.format($('A http settings with name "%s" not found for an Application Gateway "%s"'), httpSettingsName, appGatewayName));
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
    }
  },

  _parseHttpSettings: function (httpSettingsName, options, useDefaults) {
    var self = this;

    var httpSettings = {
      name: httpSettingsName
    };

    if (options.protocol) {
      var protocol = utils.verifyParamExistsInCollection(constants.appGateway.settings.protocol,
        options.protocol, 'protocol');
      httpSettings.protocol = utils.capitalizeFirstLetter(protocol);
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default protocol: %s'), constants.appGateway.settings.protocol[0]));
      httpSettings.protocol = constants.appGateway.settings.protocol[0];
    }

    if (options.port) {
      var portAsInt = utils.parseInt(options.port);
      if (isNaN(portAsInt) || portAsInt < constants.appGateway.settings.port[0] || portAsInt > constants.appGateway.settings.port[1]) {
        throw new Error(util.format($('port parameter must be an integer in range %s'),
          utils.toRange(constants.appGateway.settings.port)));
      }
      httpSettings.port = portAsInt;
    }

    if (options.cookieBasedAffinity) {
      var cookieBasedAffinity = utils.verifyParamExistsInCollection(constants.appGateway.settings.affinity,
        options.cookieBasedAffinity, 'cookie based affinity');
      httpSettings.cookieBasedAffinity = utils.capitalizeFirstLetter(cookieBasedAffinity);
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default cookie based affinity: %s'), constants.appGateway.settings.affinity[0]));
      httpSettings.cookieBasedAffinity = constants.appGateway.settings.affinity[0];
    }

    return httpSettings;
  },

  _setAppGateway: function(resourceGroup, appGatewayName, appGateway, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Setting configuration for an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkResourceProviderClient.applicationGateways.createOrUpdate(resourceGroup, appGatewayName, appGateway, _);
    }
    finally {
      progress.end();
    }
  },

  _showAppGateway: function (appGateway) {
    var self = this;
    self.interaction.formatOutput(appGateway, function (appGateway) {
      appGateway = appGateway.applicationGateway;
      self.output.nameValue($('Name'), appGateway.name);
      self.output.nameValue($('Location'), appGateway.location);
      self.output.nameValue($('Provisioning state'), appGateway.provisioningState);
      if (appGateway.sku) {
        self.output.nameValue($('Sku'), appGateway.sku.name);
      }
      var indent = 2;
      self.output.header($('Gateway IP configations'));
      appGateway.gatewayIPConfigurations.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Backend address pools'));
      appGateway.backendAddressPools.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Backend http settings'));
      appGateway.backendHttpSettingsCollection.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Frontend ip configurations'));
      appGateway.frontendIPConfigurations.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Frontend ports'));
      appGateway.frontendPorts.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Http listeners'));
      appGateway.httpListeners.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('Request routing rules'));
      appGateway.requestRoutingRules.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
      self.output.header($('SSL cerificates'));
      appGateway.sslCertificates.forEach(function (item) {
        self.output.listItem(item.name, indent);
      });
    });
  },

  _getResourceGroup: function(appGateway) {
    if(appGateway.id) {
      var idArray = appGateway.id.split('/');
      var index;
      for(var i=0; i<idArray.length; i++) {
        if(idArray[i] === 'resourceGroups') {
          index=i;
        }
      }
      return idArray[index+1];
    }
  }
});

module.exports = AppGateways;