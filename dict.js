'use strict';

export class ZhongwenDictionary {

    constructor(wordDict, wordIndex, grammarKeywords) {
        this.wordDict = wordDict;
        this.wordIndex = wordIndex;
        this.grammarKeywords = grammarKeywords;
        this.cache = {};
    }

    static find(needle, haystack) {

        let beg = 0;
        let end = haystack.length - 1;

        while (beg < end) {
            let mi = Math.floor((beg + end) / 2);
            let i = haystack.lastIndexOf('\n', mi) + 1;

            let mis = haystack.substr(i, needle.length);
            if (needle < mis) {
                end = i - 1;
            } else if (needle > mis) {
                beg = haystack.indexOf('\n', mi + 1) + 1;
            } else {
                return haystack.substring(i, haystack.indexOf('\n', mi + 1));
            }
        }

        return null;
    }

    hasKeyword(keyword) {
        return this.grammarKeywords[keyword];
    }

    wordSearch(word, max) {

        let entry = { data: [] };

        let dict = this.wordDict;
        let index = this.wordIndex;

        let maxTrim = max || 7;

        let count = 0;
        let maxLen = 0;

        WHILE:
            while (word.length > 0) {

                let ix = this.cache[word];
                if (!ix) {
                    ix = ZhongwenDictionary.find(word + ',', index);
                    if (!ix) {
                        this.cache[word] = [];
                        continue;
                    }
                    ix = ix.split(',');
                    this.cache[word] = ix;
                }

                for (let j = 1; j < ix.length; ++j) {
                    let offset = ix[j];

                    let dentry = dict.substring(offset, dict.indexOf('\n', offset));

                    if (count >= maxTrim) {
                        entry.more = 1;
                        break WHILE;
                    }

                    ++count;
                    if (maxLen === 0) {
                        maxLen = word.length;
                    }

                    entry.data.push([dentry, word]);
                }

                word = word.substr(0, word.length - 1);
            }

        if (entry.data.length === 0) {
            return null;
        }

        entry.matchLen = maxLen;
        return entry;
    }
}
