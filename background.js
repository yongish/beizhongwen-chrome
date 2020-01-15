'use strict';

import { ZhongwenDictionary } from './dict.js';

let isEnabled = localStorage['enabled'] === '1';

let isActivated = false;

let tabIDs = {};

let dict;

let zhongwenOptions = window.zhongwenOptions = {
    css: localStorage['popupcolor'] || 'yellow',
    tonecolors: localStorage['tonecolors'] || 'yes',
    fontSize: localStorage['fontSize'] || 'small',
    skritterTLD: localStorage['skritterTLD'] || 'com',
    zhuyin: localStorage['zhuyin'] || 'no',
    grammar: localStorage['grammar'] || 'yes',
    simpTrad: localStorage['simpTrad'] || 'classic',
    toneColorScheme: localStorage['toneColorScheme'] || 'standard'
};

function activateExtension(tabId, showHelp) {

    isActivated = true;

    isEnabled = true;
    // values in localStorage are always strings
    localStorage['enabled'] = '1';

    if (!dict) {
        loadDictionary().then(r => dict = r);
    }

    chrome.tabs.sendMessage(tabId, {
        'type': 'enable',
        'config': zhongwenOptions
    });

    if (showHelp) {
        chrome.tabs.sendMessage(tabId, {
            'type': 'showHelp'
        });
    }

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        'text': 'On'
    });

    chrome.contextMenus.create(
        {
            title: 'Open word list',
            onclick: function () {
                let url = chrome.runtime.getURL('/wordlist.html');
                let tabID = tabIDs['wordlist'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && tab.url && (tab.url.substr(-13) === 'wordlist.html')) {
                            chrome.tabs.reload(tabID);
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['wordlist'] = tab.id;
                                chrome.tabs.reload(tab.id);
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['wordlist'] = tab.id;
                            chrome.tabs.reload(tab.id);
                        }
                    );
                }
            }
        }
    );
    chrome.contextMenus.create(
        {
            title: 'Show help in new tab',
            onclick: function () {
                let url = chrome.runtime.getURL('/help.html');
                let tabID = tabIDs['help'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && (tab.url.substr(-9) === 'help.html')) {
                            chrome.tabs.reload(tabID);
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['help'] = tab.id;
                                chrome.tabs.reload(tab.id);
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['help'] = tab.id;
                            chrome.tabs.reload(tab.id);
                        }
                    );
                }
            }
        }
    );
}

async function loadDictData() {
    let wordDict = fetch(chrome.runtime.getURL(
        "data/cedict_ts.u8")).then(r => r.text());
    let wordIndex = fetch(chrome.runtime.getURL(
        "data/cedict.idx")).then(r => r.text());
    let grammarKeywords = fetch(chrome.runtime.getURL(
        "data/grammarKeywordsMin.json")).then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords]);
}


async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords);
}

function deactivateExtension() {

    isActivated = false;

    isEnabled = false;
    // values in localStorage are always strings
    localStorage['enabled'] = '0';

    dict = undefined;

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.browserAction.setBadgeText({
        'text': ''
    });

    // Send a disable message to all tabs in all windows.
    chrome.windows.getAll(
        { 'populate': true },
        function (windows) {
            for (let i = 0; i < windows.length; ++i) {
                let tabs = windows[i].tabs;
                for (let j = 0; j < tabs.length; ++j) {
                    chrome.tabs.sendMessage(tabs[j].id, {
                        'type': 'disable'
                    });
                }
            }
        }
    );

    chrome.contextMenus.removeAll();
}

function activateExtensionToggle(currentTab) {
    if (isActivated) {
        deactivateExtension();
    } else {
        activateExtension(currentTab.id, true);
    }
}

function enableTab(tabId) {
    if (isEnabled) {

        if (!isActivated) {
            activateExtension(tabId, false);
        }

        chrome.tabs.sendMessage(tabId, {
            'type': 'enable',
            'config': zhongwenOptions
        });
    }
}

function search(text) {

    if (!dict) {
        // dictionary not loaded
        return;
    }

    let entry = dict.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dict.hasKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.browserAction.onClicked.addListener(activateExtensionToggle);

chrome.tabs.onActivated.addListener(activeInfo => enableTab(activeInfo.tabId));
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'complete') {
        enableTab(tabId);
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

    let tabID;

    switch (request.type) {

        case 'search': {
            let response = search(request.text);
            response.originalText = request.originalText;
            callback(response);
        }
            break;

        case 'open':
            tabID = tabIDs[request.tabType];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (chrome.runtime.lastError) {
                        tab = undefined;
                    }
                    if (tab && tab.url && (tab.url.substr(-13) === 'wordlist.html')) {
                        // open existing word list
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: request.url
                        }, function (tab) {
                            tabIDs[request.tabType] = tab.id;
                        });
                    }
                });
            } else {
                chrome.tabs.create({
                    url: request.url
                }, function (tab) {
                    tabIDs[request.tabType] = tab.id;
                    if (request.tabType === 'wordlist') {
                        // make sure the table is sized correctly
                        chrome.tabs.reload(tab.id);
                    }
                });
            }
            break;

        case 'copy': {
            let txt = document.createElement('textarea');
            txt.style.position = "absolute";
            txt.style.left = "-100%";
            txt.value = request.data;
            document.body.appendChild(txt);
            txt.select();
            document.execCommand('copy');
            document.body.removeChild(txt);
        }
            break;

        case 'add': {
            let json = localStorage['wordlist'];

            let saveFirstEntryOnly = localStorage['saveToWordList'] === 'firstEntryOnly';

            let wordlist;
            if (json) {
                wordlist = JSON.parse(json);
            } else {
                wordlist = [];
            }

            for (let i in request.entries) {

                let entry = {};
                entry.timestamp = Date.now();
                entry.simplified = request.entries[i].simplified;
                entry.traditional = request.entries[i].traditional;
                entry.pinyin = request.entries[i].pinyin;
                entry.definition = request.entries[i].definition;

                wordlist.push(entry);

                if (saveFirstEntryOnly) {
                    break;
                }
            }
            localStorage['wordlist'] = JSON.stringify(wordlist);

            tabID = tabIDs['wordlist'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (tab) {
                        chrome.tabs.reload(tabID);
                    }
                });
            }
        }
            break;

        default:
        // ignore
    }
});
