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
var fs = require('fs');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var tagUtils = require('../tag/tagUtils');
var VNetUtil = require('../../../util/vnet.util');

function AppGateways(cli, networkResourceProviderClient) {
  this.interaction = cli.interaction;
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.output = cli.output;
  this.vnetUtil = new VNetUtil();
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

  delete: function (resourceGroup, appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      self.output.warn(util.format($('An Application Gateway with name "%s" not found in resource group "%s"'),
        appGatewayName, resourceGroup));
      return;
    }
    if (!options.quiet && !self.interaction.confirm(util.format($('Delete a backend address pool "%s?" [y/n] '), poolName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkResourceProviderClient.applicationGateways.deleteMethod(resourceGroup, appGatewayName, _);
    } finally {
      progress.end();
    }
  },

  start: function (resourceGroup, appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      self.output.warn(util.format($('An Application Gateway with name "%s" not found in resource group "%s"'),
        appGatewayName, resourceGroup));
      return;
    }

    self.output.info('Application gateway start command is long-running process. It may take up to 15-20 minutes to complete.');
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

  addSsl: function (resourceGroup, appGatewayName, certName, options, _) {
  var self = this;
  var appGateway = self.get(resourceGroup, appGatewayName, _);
  if (appGateway) {
    appGateway = appGateway.applicationGateway;
    if (utils.stringIsNullOrEmpty(options.certFile)) {
      throw new Error($('--cert-file parameter must not be empty'));
    }

    if (utils.stringIsNullOrEmpty(options.password)) {
      throw new Error($('--password parameter must not be empty'));
    }

    var certificateObject = {password: options.password, name: certName};
    var data = fs.readFileSync(options.certFile);
    certificateObject.data = data.toString('base64');
    appGateway.sslCertificates.push(certificateObject);
    self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
    self.show(resourceGroup, appGatewayName, options, _);
  } else {
    throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
  }
},

  removeSsl: function (resourceGroup, appGatewayName, certName, options, _) {
  var self = this;

  var appGateway = self.get(resourceGroup, appGatewayName, _);
  if (appGateway) {
    appGateway = appGateway.applicationGateway;

    var index = utils.indexOfCaseIgnore(appGateway.sslCertificates, {name: certName});
    if (index !== -1) {
      if (!options.quiet && !self.interaction.confirm(util.format($('Delete an http settings "%s"? [y/n] '), certName), _)) {
        return;
      }
      appGateway.sslCertificates.splice(index, 1);
      self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
      self.show(resourceGroup, appGatewayName, options, _);
    } else {
      throw new Error(util.format($('SSL certificate with name "%s" not found for an Application Gateway "%s"'), certName, appGatewayName));
    }
  } else {
    throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
  }

  var progress = self.interaction.progress(util.format($('Removing SSL certificate "%s" to Application Gateway "%s"'), certName, appGatewayName));
  try {
    self.networkManagementClient.applicationGateways.deleteCertificate(appGatewayName, certName, _);
  } finally {
    progress.end();
  }
},

  addFrontendPort: function (resourceGroup, appGatewayName, frontendPortName, port, options, _) {
  var self = this;
  var appGateway = self.get(resourceGroup, appGatewayName, _);
  if (!appGateway) {
    throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
  }

  appGateway = appGateway.applicationGateway;
  var frontendPort = utils.findFirstCaseIgnore(appGateway.frontendPorts, {name: frontendPortName});
  if (frontendPort) {
    throw new Error(util.format($('A frontend port with name "%s" already exists for an Application Gateway "%s"'), frontendPortName, appGatewayName));
  }
  frontendPort = {
    name: frontendPortName,
    port: port
  };

  appGateway.frontendPorts.push(frontendPort);
  self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
  self.show(appGateway);
},

  removeFrontendPort: function (resourceGroup, appGatewayName, frontendPortName, options, _) {
  var self = this;
  var appGateway = self.get(resourceGroup, appGatewayName, _);
  if (!appGateway) {
    throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
  }

  appGateway = appGateway.applicationGateway;
  var index = utils.indexOfCaseIgnore(appGateway.frontendPorts, {name: frontendPortName});
  if (index === -1) {
    throw new Error(util.format($('Frontend port with name "%s" not found for an Application Gateway "%s'), frontendPortName, appGatewayName));
  }

  if (!options.quiet && !self.interaction.confirm(util.format($('Delete a frontend port "%s?" [y/n] '), frontendPortName), _)) {
    return;
  }

  appGateway.frontendPorts.splice(index, 1);
  self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
  self.show(resourceGroup, appGatewayName, options, _);
},

  addBackendAddressPool: function (resourceGroup, appGatewayName, poolName, options, _) {
    var self = this;
    var dnsServers = self._parseDnsServers(options);
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
    }

    appGateway = appGateway.applicationGateway;
    var pool = utils.findFirstCaseIgnore(appGateway.backendAddressPools, {name: poolName});
    if (pool) {
      throw new Error(util.format($('A backend address pool with name "%s" already exists for an Application Gateway "%s"'), poolName, appGatewayName));
    } else {
      var addressPool = {
        name: poolName,
        backendAddresses: dnsServers
      };
      appGateway.backendAddressPools.push(addressPool);

      self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
      self.show(resourceGroup, appGatewayName, options, _);
    }
  },

  removeBackendAddressPool: function (resourceGroup, appGatewayName, poolName, options, _) {
    var self = this;
    var appGateway = self.get(resourceGroup, appGatewayName, _);
    if (!appGateway) {
      throw new Error(util.format($('Application Gateway "%s" not found in resource group "%s"'), appGatewayName, resourceGroup));
    }

    appGateway = appGateway.applicationGateway;
    var index = utils.indexOfCaseIgnore(appGateway.backendAddressPools, {name: poolName});
    if (index !== -1) {
      if (!options.quiet && !self.interaction.confirm(util.format($('Delete a backend address pool "%s?" [y/n] '), poolName), _)) {
        return;
      }
      appGateway.backendAddressPools.splice(index, 1);
      self._setAppGateway(resourceGroup, appGatewayName, appGateway, _);
      self.show(resourceGroup, appGatewayName, options, _);
    } else {
      throw new Error(util.format($('A backend address pool with name "%s" not found for an Application Gateway "%s"'), poolName, appGatewayName));
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

  _parseDnsServers: function (options) {
    var self = this;

    var ipAddresses = options.servers.split(',');
    var dnsServers = [];

    ipAddresses.forEach(function (address) {
      var ipValidationResult = self.vnetUtil.parseIPv4(address);
      if (ipValidationResult.error) {
        var dnsValidationResult = self.vnetUtil.isValidDns(address);
        if (dnsValidationResult === false) {
          throw new Error(util.format($('Address "%s" is not valid IPv4 or DNS name'), address));
        }
      }
      var dns = {ipAddress: address};
      dnsServers.push(dns);
    });

    return dnsServers;
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

  _setAppGateway: function (resourceGroup, appGatewayName, appGateway, _) {
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
    self.interaction.formatOutput(appGateway.applicationGateway, function (appGateway) {
      self.output.nameValue($('Id'), appGateway.id);
      self.output.nameValue($('Name'), appGateway.name);
      self.output.nameValue($('Location'), appGateway.location);
      self.output.nameValue($('Provisioning state'), appGateway.provisioningState);
      self.output.nameValue($('Sku'), appGateway.sku.name);
      self.output.nameValue($('Resource Group'), self._getResourceGroup(appGateway));
      self.output.nameValue($('Tags'), tagUtils.getTagsInfo(appGateway.tags));
      self.output.nameValue($('Gateway IP configations'), self._getAttributeNames(appGateway.gatewayIPConfigurations));
      self.output.nameValue($('SSL cerificates'), self._getAttributeNames(appGateway.sslCertificates));
      self.output.nameValue($('Frontend ip configurations'), self._getAttributeNames(appGateway.frontendIPConfigurations));
      self.output.nameValue($('Frontend ports'), self._getAttributeNames(appGateway.frontendPorts));
      self.output.nameValue($('Backend address pools'), self._getAttributeNames(appGateway.backendAddressPools));
      self.output.nameValue($('Backend http settings'), self._getAttributeNames(appGateway.backendHttpSettingsCollection));
      self.output.nameValue($('Http listeners'), self._getAttributeNames(appGateway.httpListeners));
      self.output.nameValue($('Request routing rules'), self._getAttributeNames(appGateway.requestRoutingRules));
    });
  },

  _getAttributeNames: function(list) {
    var namesString='[';
    var counter = 0;
    list.forEach(function (item) {
      if(counter>0) {
        namesString += ', ';
      }
      namesString += item.name;
      counter++;
    });
    namesString += ']';
    return namesString;
  },

  _getResourceGroup: function (appGateway) {
    if (appGateway.id) {
      var idArray = appGateway.id.split('/');
      var index;
      for (var i = 0; i < idArray.length; i++) {
        if (idArray[i] === 'resourceGroups') {
          index = i;
        }
      }
      return idArray[index + 1];
    }
  }
});

module.exports = AppGateways;