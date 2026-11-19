const { withAndroidManifest } = require('@expo/config-plugins');

const defaultApiUrl = 'http://localhost:3000/api';
const productionApiUrl = 'https://myagriseta.onrender.com/api';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function getApiUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (process.env.NODE_ENV !== 'production') return configuredUrl || defaultApiUrl;
  if (!configuredUrl) return productionApiUrl;

  try {
    return loopbackHosts.has(new URL(configuredUrl).hostname) ? productionApiUrl : configuredUrl;
  } catch {
    return productionApiUrl;
  }
}

function allowsPrivateNetworkHttp(apiUrl) {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'http:') return false;
    if (url.hostname === 'localhost' || url.hostname === '10.0.2.2') return true;

    const octets = url.hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return false;
    }

    return octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const allowPrivateNetworkHttp = allowsPrivateNetworkHttp(getApiUrl());
  const configWithNetworkPolicy = {
    ...config,
    android: {
      ...config.android,
      usesCleartextTraffic: allowPrivateNetworkHttp,
    },
  };

  return withAndroidManifest(configWithNetworkPolicy, (modConfig) => {
    modConfig.modResults.manifest.application[0].$['android:usesCleartextTraffic'] =
      String(allowPrivateNetworkHttp);
    return modConfig;
  });
};
