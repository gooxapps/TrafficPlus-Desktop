const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  userGet: (userId) => ipcRenderer.invoke('user:get', userId),
  userList: () => ipcRenderer.invoke('user:list'),
  userUpsert: (user) => ipcRenderer.invoke('user:upsert', user),
  userTrackLogin: (userId, meta) => ipcRenderer.invoke('user:track-login', userId, meta),
  userDelete: (userId) => ipcRenderer.invoke('user:delete', userId),
  userHistory: (userId) => ipcRenderer.invoke('user:history', userId),
  userUpdate: (userId, patch) => ipcRenderer.invoke('user:update', userId, patch),
  browserOpen: (url, slotId, deviceType, mode, searchEngine, searchKeywords, searchPlatform, searchTargetName, searchPage, searchSort, networkThrottle, proxy, userAgent, headless) => 
    ipcRenderer.invoke('browser:open', { url, slotId, deviceType, mode, searchEngine, searchKeywords, searchPlatform, searchTargetName, searchPage, searchSort, networkThrottle, proxy, userAgent, headless }),
  browserClose: (slotId) => ipcRenderer.invoke('browser:close', { slotId }),
  browserCloseAll: () => ipcRenderer.invoke('browser:closeAll'),
  browserWait: (slotId, durationMs) => ipcRenderer.invoke('browser:wait', { slotId, durationMs }),
  browserGetDevices: () => ipcRenderer.invoke('browser:getDevices'),
  notificationsGet: (userId) => ipcRenderer.invoke('notifications:get', userId),
  notificationsCreate: (userId, type, title, message) => ipcRenderer.invoke('notifications:create', { userId, type, title, message }),
  notificationsMarkRead: (notificationId) => ipcRenderer.invoke('notifications:markRead', notificationId),
  notificationsDelete: (notificationId) => ipcRenderer.invoke('notifications:delete', notificationId),
  contactsGet: (userId) => ipcRenderer.invoke('contacts:get', userId),
  contactsCreate: (userId, name, email, phone, notes) => ipcRenderer.invoke('contacts:create', { userId, name, email, phone, notes }),
  contactsUpdate: (contactId, patch) => ipcRenderer.invoke('contacts:update', contactId, patch),
  contactsDelete: (contactId) => ipcRenderer.invoke('contacts:delete', contactId),
  savedCampaignsGet: (userId) => ipcRenderer.invoke('savedCampaigns:get', userId),
  savedCampaignsCreate: (userId, name, title, url, category, creditsAllocated, dailyLimit, targetCountries, mode, searchEngine, searchKeywords) => 
    ipcRenderer.invoke('savedCampaigns:create', { userId, name, title, url, category, creditsAllocated, dailyLimit, targetCountries, mode, searchEngine, searchKeywords }),
  savedCampaignsDelete: (savedCampaignId) => ipcRenderer.invoke('savedCampaigns:delete', savedCampaignId),
  proxiesGet: (userId) => ipcRenderer.invoke('proxies:get', userId),
  proxiesCreate: (userId, type, host, port, username, password, country, timezone, language) => 
    ipcRenderer.invoke('proxies:create', { userId, type, host, port, username, password, country, timezone, language }),
  proxiesUpdate: (proxyId, patch) => ipcRenderer.invoke('proxies:update', proxyId, patch),
  proxiesDelete: (proxyId) => ipcRenderer.invoke('proxies:delete', proxyId),
  proxiesImportFile: (userId, filePath) => ipcRenderer.invoke('proxies:import-file', { userId, filePath }),
  proxiesImportContent: (userId, content) => ipcRenderer.invoke('proxies:import-content', { userId, content }),
  proxiesScrape: (userId, url) => ipcRenderer.invoke('proxies:scrape', { userId, url }),
  proxiesTest: (proxy) => ipcRenderer.invoke('proxies:test', proxy),
  proxiesScrapeFree: (userId, options) => ipcRenderer.invoke('proxies:scrape-free', { userId, ...options }),
  dialogOpenFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  browserSetHidden: (hidden) => ipcRenderer.invoke('browser:setHidden', { hidden }),
  onSurfChallenge: (cb) => {
    ipcRenderer.on('surf:challenge', (event, data) => {
      try { cb(data); } catch (e) { console.error('onSurfChallenge callback error:', e); }
    });
  },
  // Auto-update API
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateEvent: (cb) => {
    const handler = (event, type, payload) => {
      try { cb(type, payload); } catch (e) { console.error('onUpdateEvent callback error:', e); }
    };
    ipcRenderer.on('update:event', handler);
    return () => ipcRenderer.removeListener('update:event', handler);
  },
  // 2Captcha API
  captchaSet2CaptchaKey: (apiKey) => ipcRenderer.invoke('captcha:set2CaptchaKey', apiKey),
  captchaGet2CaptchaKey: () => ipcRenderer.invoke('captcha:get2CaptchaKey'),
  captcha2CaptchaIsConfigured: () => ipcRenderer.invoke('captcha:is2CaptchaConfigured')
});
