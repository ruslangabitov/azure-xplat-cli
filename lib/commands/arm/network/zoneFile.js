var __ = require('underscore');
var util = require('util');
var utils = require('../../../util/utils');

function ZoneFile(output) {
  this.output = output;
  this.defaultTtl = 3600;
  this.defaultTemplate = '; Zone: {zone}\n\
; Exported  (yyyy-mm-ddThh:mm:ss.sssZ): {datetime}\n\
\n\
{$origin}\n\
{$ttl}\n\
\n\
; SOA Record\n\
{name} {ttl}	IN	SOA	{mname}{rname}(\n\
{serial} ;serial\n\
{refresh} ;refresh\n\
{retry} ;retry\n\
{expire} ;expire\n\
{minimum} ;minimum ttl\n\
)\n\
\n\
; NS Records\n\
{ns}\n\
\n\
; MX Records\n\
{mx}\n\
\n\
; A Records\n\
{a}\n\
\n\
; AAAA Records\n\
{aaaa}\n\
\n\
; CNAME Records\n\
{cname}\n\
\n\
; PTR Records\n\
{ptr}\n\
\n\
; TXT Records\n\
{txt}\n\
\n\
; SRV Records\n\
{srv}\n\
\n\
; SPF Records\n\
{spf}\n\
';
}

__.extend(ZoneFile.prototype, {

  parse: function (text) {
    text = this.removeComments(text);
    text = this.flatten(text);
    return this.parseRRs(text);
  },

  generate: function () {
    var template = this.defaultTemplate;
    template = this.generate$ORIGIN(options['$origin'], template);
    template = this.generate$TTL(options['$ttl'], template);
    template = this.generateSOA(options['soa'], template);
    template = this.generateNS(options['ns'], template);
    template = this.generateA(options['a'], template);
    template = this.generateAAAA(options['aaaa'], template);
    template = this.generateCNAME(options['cname'], template);
    template = this.generateMX(options['mx'], template);
    template = this.generatePTR(options['ptr'], template);
    template = this.generateTXT(options['txt'], template);
    template = this.generateSRV(options['srv'], template);
    template = this.generateSPF(options['spf'], template);
    template = this.generateValues(options, template);
    return template.replace(/\n{2,}/gim, '\n\n');
  },

  removeComments: function (text) {
    return text.replace(/;[\s\S]*?$/gm, '');
  },

  /**
   * Parse methods
   */

  flatten: function (text) {
    var captured = [];
    var re = /\([\s\S]*?\)/gim;
    var match = re.exec(text);
    while (match !== null) {
      match.replacement = match[0].replace(/\s+/gm, ' ');
      captured.push(match);
      // captured Text, index, input
      match = re.exec(text);
    }
    var arrText = text.split('');
    for (var i in captured) {
      match = captured[i];
      arrText.splice(match.index, match[0].length, match.replacement);
    }
    return arrText.join('').replace(/\(|\)/gim, ' ');
  },

  parseRRs: function (text, output) {
    var self = this;
    var res = {
      sets: []
    };
    var rrs = text.split('\n');
    for (var i in rrs) {
      var rr = rrs[i];
      if (!rr || !rr.trim()) {
        continue;
      }
      var uRR = rr.toUpperCase();
      var recordSet;
      var prevRRname;
      if (uRR.indexOf('$ORIGIN') === 0) {
        res.$origin = self.parse$ORIGIN(rr);
      } else if (uRR.indexOf('$TTL') === 0) {
        res.$ttl = self.parse$TTL(rr);
      } else if (/\s+SOA\s+/.test(uRR)) {
        recordSet = self.parseSOA(rr, res.$ttl);
      } else if (/\s+NS\s+/.test(uRR)) {
        recordSet = self.parseNS(rr, res.$origin, res.$ttl, prevRRname);
      } else if (/\s+A\s+/.test(uRR)) {
        recordSet = self.parseA(rr, res.$ttl, prevRRname);
      } else if (/\s+AAAA\s+/.test(uRR)) {
        recordSet = self.parseAAAA(rr, res.$ttl, prevRRname);
      } else if (/\s+CNAME\s+/.test(uRR)) {
        recordSet = self.parseCNAME(rr, res.$origin, res.$ttl, prevRRname);
      } else if (/\s+TXT\s+/.test(uRR)) {
        recordSet = self.parseTXT(rr, res.$ttl, prevRRname);
      } else if (/\s+MX\s+/.test(uRR)) {
        recordSet = self.parseMX(rr, res.$origin, res.$ttl, prevRRname);
      } else if (/\s+PTR\s+/.test(uRR)) {
        recordSet = self.parsePTR(rr, res.$origin, res.$ttl, prevRRname);
      } else if (/\s+SRV\s+/.test(uRR)) {
        recordSet = self.parseSRV(rr, res.$origin, res.$ttl, prevRRname);
      } else {
        this.output.warn(util.format('Unrecognized record: %s', rr));
        continue;
      }

      if (recordSet) {
        var index = utils.indexOfCaseIgnore(res.sets, {name: recordSet.name, type: recordSet.type});
        if (index === -1) {
          res.sets.push(recordSet); // create new RecordSet
        } else {
          res.sets[index].records.push(recordSet.records[0]); // Use existing Record set
          if (recordSet.ttl < res.sets[index].ttl) {
            res.sets[index].ttl = recordSet.ttl;
          }
        }
        prevRRname = recordSet.name;
        recordSet = undefined;
      }
    }
    return res;
  },

  parse$ORIGIN: function (rr) {
    return rr.split(/\s+/g)[1];
  },

  parse$TTL: function (rr) {
    var value = rr.split(/\s+/g)[1];
    var ttl = this.parseTimestamp(value);
    return ttl;
  },

  /**
   * Returns seconds number from 1m, 2h, 3d, 4m time format
   */
  parseTimestamp: function (timestamp) {
    var seconds;
    if (!isNaN(timestamp)) {
      seconds = parseInt(timestamp, 10);
      return seconds;
    }
    seconds = timestamp.substr(0, timestamp.length - 1);
    var lastChar = timestamp.substr(timestamp.length - 1);
    switch (lastChar.toLowerCase()) {
      case 'm':
        seconds = seconds * 60;
        break;
      case 'h':
        seconds = seconds * 3600;
        break;
      case 'd':
        seconds = seconds * 86400;
        break;
      case 'w':
        seconds = seconds * 604800;
        break;
    }
    return seconds;
  },

  parseRR: function (rr, $ttl, prevRRname) {
    var res = {
      data: []
    };

    var validTypes = ['SOA', 'NS', 'A', 'AAAA', 'CNAME', 'TXT', 'MX', 'PTR', 'SRV'];
    var validClasses = ['IN', 'CS', 'CH', 'HS'];
    var rrTokens = rr.trim().split(/\s+/g);

    if (rrTokens.length < 3) {
      res.error = 'Invalid record format: ' + rr;
      return res;
    }

    var position = 0;
    while (rrTokens.length > 0) {
      var token = rrTokens.shift();
      if (validClasses.indexOf(token.toUpperCase()) !== -1 && (position <= 2)) {
        res.class = token.toUpperCase();
      } else if (validTypes.indexOf(token.toUpperCase()) !== -1 && (position <= 3)) {
        res.type = token.toUpperCase();
      } else if (!isNaN(token) && (position <= 1)) {
        res.ttl = parseInt(token, 10);
      } else if (position == 0) {
        res.name = token;
      } else {
        res.data.push(token)
      }
      position++;
    }

    if (res.data.length < 1) {
      res.error = 'Invalid record format: ' + rr;
      return res;
    }

    if (!res.ttl) res.ttl = $ttl || this.defaultTtl;
    if (!res.name) res.name = prevRRname;

    return res;
  },

  convertToFQDN: function (value, $origin) {
    if (utils.stringEndsWith(value, ".", true)) return value;
    if (!$origin) {
      this.output.warn('$ORIGIN directive is not defined');
      return value;
    } else {
      return value + "." + $origin;
    }
  },

  parseSOA: function (rr, $ttl, prevRRname) {
    var self = this;
    var res = this.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var soa = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        host: res.data[0],
        email: res.data[1],
        serialNumber: self.parseTimestamp(res.data[2]),
        refreshTime: self.parseTimestamp(res.data[3]),
        retryTime: self.parseTimestamp(res.data[4]),
        expireTime: self.parseTimestamp(res.data[5]),
        minimumTtl: self.parseTimestamp(res.data[6])
      }]
    };
    return soa;
  },

  parseNS: function (rr, $origin, $ttl, prevRRname) {
    var self = this;
    var res = this.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var ns = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        nsdname: self.convertToFQDN(res.data[0], $origin)
      }]
    };
    return ns;
  },

  parseA: function (rr, $ttl, prevRRname) {
    var res = this.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var a = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        ipv4Address: res.data[0]
      }]
    };
    return a;
  },

  parseAAAA: function (rr, $ttl, prevRRname) {
    var res = this.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var aaaa = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        ipv6Address: res.data[0]
      }]
    };
    return aaaa;
  },

  parseCNAME: function (rr, $origin, $ttl, prevRRname) {
    var self = this;
    var res = this.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var cname = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        cname: self.convertToFQDN(res.data[0], $origin)
      }]
    };
    return cname;
  },

  parseMX: function (rr, $origin, $ttl, prevRRname) {
    var self = this;
    var res = self.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var mx = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        preference: parseInt(res.data[0]),
        exchange: self.convertToFQDN(res.data[1], $origin)
      }]
    };
    return mx;
  },

  parseTXT: function (rr, $ttl, prevRRname) {
    var self = this;
    var res = self.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var value = '';
    while (res.data.length > 0) {
      value += res.data.shift() + " ";
    }

    var txt = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        value: value.trim()
      }]
    };
    return txt;
  },

  parsePTR: function (rr, $origin, $ttl, prevRRname) {
    var self = this;
    var res = self.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var ptr = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        ptrdname: self.convertToFQDN(res.data[0], $origin)
      }]
    };
    return ptr;
  },

  parseSRV: function (rr, $origin, $ttl, prevRRname) {
    var self = this;
    var res = self.parseRR(rr, $ttl, prevRRname);
    if (res.error) {
      this.output.warn(res.error);
      return;
    }

    var srv = {
      name: res.name,
      type: res.type,
      ttl: res.ttl,
      records: [{
        priority: parseInt(res.data[0]),
        weight: parseInt(res.data[1]),
        port: parseInt(res.data[2]),
        target: self.convertToFQDN(res.data[3], $origin)
      }]
    };
    return srv;
  },

  /**
   * Generate methods
   */

  generate$ORIGIN: function (data, template) {
    var ret = '';
    if (typeof data !== 'undefined') {
      ret += '$ORIGIN ' + data;
    }
    return template.replace('{$origin}', ret);
  },

  generate$TTL: function (data, template) {
    var ret = '';
    if (typeof data !== 'undefined') {
      ret += '$TTL ' + data;
    }
    return template.replace('{$ttl}', ret);
  },

  generateSOA: function (data, template) {
    var ret = template;
    data.name = data.name || '@';
    data.ttl = data.ttl || '';
    for (var key in data) {
      var value = data[key];
      ret = ret.replace('{' + key + '}', value + '\t');
    }
    return ret;
  },

  generateNS: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tNS\t' + data[i].host + '\n';
    }
    return template.replace('{ns}', ret);
  },

  generateA: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tA\t' + data[i].ip + '\n';
    }
    return template.replace('{a}', ret);
  },

  generateAAAA: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tAAAA\t' + data[i].ip + '\n';
    }
    return template.replace('{aaaa}', ret);
  },

  generateCNAME: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tCNAME\t' + data[i].alias + '\n';
    }
    return template.replace('{cname}', ret);
  },

  generateMX: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tMX\t' + data[i].preference + '\t' + data[i].host + '\n';
    }
    return template.replace('{mx}', ret);
  },

  generatePTR: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tPTR\t' + data[i].host + '\n';
    }
    return template.replace('{ptr}', ret);
  },

  generateTXT: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tTXT\t"' + data[i].txt + '"\n';
    }
    return template.replace('{txt}', ret);
  },

  generateSRV: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tSRV\t' + data[i].priority + '\t';
      ret += data[i].weight + '\t';
      ret += data[i].port + '\t';
      ret += data[i].target + '\n';
    }
    return template.replace('{srv}', ret);
  },

  generateSPF: function (data, template) {
    var ret = '';
    for (var i in data) {
      ret += (data[i].name || '@') + '\t';
      if (data[i].ttl) ret += data[i].ttl + '\t';
      ret += 'IN\tSPF\t' + data[i].data + '\n';
    }
    return template.replace('{spf}', ret);
  },

  generateValues: function (options, template) {
    template = template.replace('{zone}', options['$origin'] || options['soa']['name'] || '');
    template = template.replace('{datetime}', (new Date()).toISOString());
    return template.replace('{time}', Math.round(Date.now() / 1000));
  }

});

module.exports = ZoneFile;
