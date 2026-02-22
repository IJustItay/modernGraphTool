import { DataProvider, FRParser, URLProvider } from "../../core.min.js";

// SquigLoader UI Constants
const ADD_BUTTON_CLASS = 'add-phone-button';
const ADD_SYMBOL = '+';
const REMOVE_SYMBOL = '-';
const WARNING_SYMBOL = '!';
// Extension metadata for version compatibility
export const EXTENSION_METADATA = {
  name: 'squiglink-integration',
  version: '1.0.1',
  apiLevel: 1,
  coreMinVersion: '1.0.0',
  coreMaxVersion: '1.0.x',
  description: 'Squiglink integration for modernGraphTool',
  author: 'potatosalad775'
};

window.activePhones = []; // Expose activePhones List Globally
window.baseline = { p: null, l: null, fn: l => l }; // Expose baseline Object Globally
window.targetWindow = null; // Expose targetWindow Object Globally

// Function to update the active phones
function updateActivePhones() {
  Array.from(DataProvider.getFRDataMap()).forEach(([uuid, phone]) => {
    window.activePhones.push({
      uuid: uuid,
      isTarget: phone.type === 'target',
      fullName: phone.identifier,
      dispName: phone.identifier + " " + phone.dispSuffix,
    })
  });

  window.addEventListener('core:fr-phone-added', (e) => {
    const phone = DataProvider.frDataMap.get(e.detail.uuid);
    window.activePhones.push({
      uuid: phone.uuid,
      isTarget: false,
      fullName: phone.identifier,
      dispName: phone.identifier + " " + phone.dispSuffix,
    })
  });

  window.addEventListener('core:fr-target-added', (e) => {
    const phone = DataProvider.frDataMap.get(e.detail.uuid);
    window.activePhones.push({
      uuid: phone.uuid,
      isTarget: false,
      fullName: phone.identifier,
      dispName: phone.identifier + " " + phone.dispSuffix,
    })
  });

  window.addEventListener('core:fr-phone-removed', (e) => {
    window.activePhones = window.activePhones.filter((phone) => phone.uuid !== e.detail.uuid);
  });

  window.addEventListener('core:fr-target-removed', (e) => {
    window.activePhones = window.activePhones.filter((phone) => phone.uuid !== e.detail.uuid);
  });
}
updateActivePhones();

// Function to update targetWindow Object for fauxnItem (Search Results)
function updateTargetWindow() {
  // See if iframe gets CORS error when interacting with window.top
  try {
    let emb = window.location.href.includes('embed');
    targetWindow = emb ? window : window.top;
  } catch {
    targetWindow = window;
  }
}
updateTargetWindow();

// Function to add Baseline Event Listener for fauxnItem (Search Results)
function addBaselineUpdater() {
  window.addEventListener('core:fr-baseline-updated', (e) => {
    window.baseline = {
      ...window.baseline,
      p: {
        fileName: e.detail.baselineIdentifier
      },
    }
  })
}
addBaselineUpdater();

export default class SquiglinkIntegration {
  constructor(config = {}) {
    this.config = config;
    this.scriptsLoaded = false;

    // Analytic Parameter
    window.ANALYTICS_SITE = this.config.ANALYTICS_SITE || "";
    window.ANALYTICS_GTM_ID = this.config.ANALYTICS_GTM_ID || "";
    window.LOG_ANALYTICS = this.config.LOG_ANALYTICS || true;
  }

  async init() {
    await this._initElements();
    await this._loadDependencies();
    this._initSquiglinkFeatures();
    this._initSquigLoader();
  }

  async _initElements() {
    // Add necessary classes / elements for Squiglink integration
    document.querySelector('.ps-header-search')?.classList.add('search');
    document.querySelector('.menu-bar-item[data-target="equalizer-panel"]')?.classList.add('extra');
    // Add IDs and Classes to Phone List for Squiglink Search integration
    const phoneList = document.querySelector('.ps-phone-list');
    if (phoneList) {
      phoneList.id = 'phones';
      phoneList.classList.add('scroll');
    }
    phoneList.querySelectorAll('.ps-phone-item')?.forEach((item) => {
      item.classList.add('phone-item');
    });
    const searchResultStyle = document.createElement('style');
    searchResultStyle.textContent = `
      .db-site-container {
        background-color: var(--gt-color-tertiary-container) !important;
        color: var(--gt-color-on-tertiary-container);
        border: 1px solid var(--gt-color-tertiary);
        border-radius: 0.75rem !important;
        margin-bottom: 0.75rem;
      }
      .db-site-header {
        position: initial !important;
        border-bottom: 1px solid var(--gt-color-outline) !important;
      }
      .db-site-header:before {
        display: none !important;
      }
      .db-site-header:after {
        background: var(--gt-color-tertiary) !important;
      }
      .fauxn-link {
        color: var(--gt-color-on-tertiary-container) !important;
      }
      .fauxn-link:before {
        background-color: var(--gt-color-on-tertiary-container) !important;
      }
    `;
    phoneList?.appendChild(searchResultStyle);
    // Replace Target Group Name with Div for Squiglink Delta integration
    document.querySelectorAll('.target-list-container')?.forEach((container) => {
      container.classList.add('targetClass');
      const divElement = container.querySelector('.target-group-name');
      if (divElement) { divElement.classList.add('targetLabel'); }
    });
    const targetClassStyle = document.createElement('style');
    targetClassStyle.textContent = `
      .targetClass.delta-targets:before {
        width: 4.5rem !important;
        height: 1.5rem !important;
        margin: 0 !important;
        background: var(--gt-color-primary) !important;
      }
      .welcome-deltaReady-launcher { 
        margin: 0 !important;
        color: var(--gt-color-on-secondary) !important;
        background-color: var(--gt-color-secondary) !important;
      }
    `;
    document.querySelector('.target-selector-group')?.appendChild(targetClassStyle);
    // Add Header Link for Squiglink Options
    const headerLink = document.createElement('ul');
    headerLink.className = 'header-links';
    headerLink.style = `
      list-style-type: none;
      margin: 0 1rem 0 0.5rem;
      padding: 0;
      overflow: hidden;
    `
    headerLink.innerHTML = `
      <style>
        .squig-select-li { padding: 0 !important; margin: 0 !important; }
        .squig-select {
          background-color: var(--gt-color-surface-container-lowest) !important;
          color: var(--gt-color-on-surface) !important;
          border: 1px solid var(--gt-color-outline) !important;
          border-radius: 0.5rem !important;
          max-width: 10rem !important;
        }
      </style>`
    document.querySelector('.top-nav-bar-leading')?.appendChild(headerLink);
    // Add Helper Row to Graph Panel for Squiglink Intro
    const introRow = document.createElement('div');
    introRow.classList.add('tools', 'menu-panel-row');
    introRow.innerHTML = `
      <style>
        .tools { display: flex; flex-direction: row; width: 100%; padding: 1rem 0 0.1rem 0; }
        .welcome-launcher-container { padding: 0 !important; }
        .welcome-launcher { 
          color: var(--gt-color-on-secondary) !important;
          background-color: var(--gt-color-secondary) !important;
        }
        .shop-link-container { padding: 0 0 0 0.1rem !important; }
        .shop-link-container span { color: var(--gt-color-on-surface) !important; }
        .welcome-sponsor-launcher { padding: 0 !important; }
        article.shop-link-container {
          animation: shoplink-in-custom 0.4s ease-in-out 1 forwards !important;
        }
        article.shop-link-container.remove {
          animation: shoplink-out-custom 0.2s ease-in-out 1 forwards !important;
        }
        div.tools.shop-link-active > button.welcome-sponsor-launcher {
          animation: shoplink-out-custom 0.2s ease-in-out 1 forwards !important;
        }
        button.welcome-sponsor-launcher {
          animation: shoplink-in-custom 0.4s ease-in-out 1 forwards !important;
        }
        @keyframes shoplink-in-custom {
          0% { opacity: 0; margin-left: -200px; }
          100% { opacity: 1; margin-left: 0px; }
        }
        @keyframes shoplink-out-custom {
          0% { opacity: 1; margin-left: 0px; }
          100% { opacity: 0; margin-left: -200px; }
        }
      </style>`;
    // Add Intro Row to Target Selector
    const targetSelectorButtonGroup = document.querySelector('.tsc-collapse-button-group');
    if (targetSelectorButtonGroup) {
      // (Collapse) Button Group is only available when targetSelector is in multiple rows
      targetSelectorButtonGroup.appendChild(introRow);
    } else {
      // Single Row Target Selector, add to Graph Panel before Divider for better spacing
      const graphPanel = document.querySelector('#graph-panel');
      const divider = graphPanel?.querySelector('gt-divider');
      if (graphPanel) {
        graphPanel.insertBefore(introRow, divider);
      }
    }
    // Add Helper Row to Graph Panel for Squiglink Intro
    document.querySelector('.eq-uploader')?.classList.add('extra-upload');
    const extraUploadStyle = document.createElement('style');
    extraUploadStyle.textContent = `
      .welcome-eq-launcher-container { position: static !important }
      .welcome-eq-launcher {
        color: var(--gt-color-on-secondary) !important;
        background-color: var(--gt-color-secondary) !important;
      }`;
    document.querySelector('.eq-uploader')?.appendChild(extraUploadStyle);
  }

  async _loadDependencies() {
    // Load graphAnalytics and squigsites from local reference
    await Promise.all([
      this._injectScript('./extensions/squiglink-integration/graphAnalytics.js'),
      this._injectScript('https://squig.link/squigsites.js')
    ]);

    this.scriptsLoaded = true;
  }

  _initSquiglinkFeatures() {
    // Wait for graph container to be ready
    const waitForGraph = setInterval(() => {
      if (customElements.get('graph-container') && this.scriptsLoaded) {
        clearInterval(waitForGraph);
        // Add Delta Target Mods from Squig.link
        window.deltaTargetMods();
        // Connect Graph Analytic Event Listeners
        this._connectGraphAnalytics();
      }
    }, 100);
  }

  async _injectScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  _connectGraphAnalytics() {
    if (!this.config.ENABLE_ANALYTICS) return;
    // See if iframe gets CORS error when interacting with window.top
    let targetWindow;
    try {
      let emb = window.location.href.includes('embed');
      targetWindow = emb ? window : window.top;
    } catch {
      targetWindow = window;
    }
    // Connect screenshot analytics
    const screenshotButton = document.querySelector('.screenshot-button');
    if (screenshotButton && window.pushEventTag) {
      screenshotButton.addEventListener('click', () => {
        window.pushEventTag("clicked_download", targetWindow);
      });
    }
    // Connect Equalizer analytics
    const equalizerButton = document.querySelector('.menu-bar-item[data-target="equalizer-panel"]');
    if (equalizerButton && window.pushEventTag) {
      equalizerButton.addEventListener('click', () => {
        window.pushEventTag("clicked_equalizer", targetWindow);
      });
    }
    // Connect Baseline analytics
    window.addEventListener('core:fr-baseline-updated', (e) => {
      const phone = DataProvider.frDataMap.get(e.detail.baselineUUID);
      if (phone) {
        window.pushPhoneTag("baseline_set", {
          phone: phone.type === 'target' ? phone.identifier.replace(/ Target$/, '') : phone.meta.name,
          dispBrand: phone.type === 'target' ? 'Target' : phone.meta.brand,
          dispName: phone.type === 'target' ? phone.identifier.replace(/ Target$/, '') : phone.meta.name + ' ' + phone.dispSuffix,
        });
      }
    });
    // Connect Phone analytics
    window.addEventListener('core:fr-phone-added', (e) => {
      const phone = DataProvider.frDataMap.get(e.detail.uuid);
      if (phone) {
        window.pushPhoneTag("phone_displayed", {
          phone: phone.meta.name,
          dispBrand: phone.meta.brand,
          dispName: phone.meta.name + ' ' + phone.dispSuffix,
        });
      }
    });
    window.addEventListener('core:fr-target-added', (e) => {
      const phone = DataProvider.frDataMap.get(e.detail.uuid);
      if (phone) {
        window.pushPhoneTag("phone_displayed", {
          phone: phone.identifier.replace(/ Target$/, ''),
          dispBrand: 'Target',
          dispName: phone.identifier.replace(/ Target$/, ''),
        });
      }
    });
  }

  // Native SquigLoader Integration
  _initSquigLoader() {
    // Watch for changes in div#phones (when squigsites.js populates other databases)
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              node.classList.contains('fauxn-item')
            ) {
              this._addShowPhoneButton(node);
            }
          });
        }
      }
    });

    // Wait for phone list to exist before observing
    const waitForList = setInterval(() => {
      const phonesDiv = document.querySelector('div#phones');
      if (phonesDiv) {
        clearInterval(waitForList);
        observer.observe(phonesDiv, { childList: true, subtree: true });
      }
    }, 100);
  }

  _addShowPhoneButton(fauxnItem) {
    const addButton = document.createElement('button');
    addButton.style.cssText = `
      margin-left: auto;
      margin-right: 12px;
      font-size: 16px;
      border-radius: 4px;
      color: var(--gt-color-on-surface);
      background-color: transparent;
      border: 1px solid var(--gt-color-outline);
      cursor: pointer;
      width: 24px;
      height: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
    `;
    addButton.textContent = ADD_SYMBOL;
    addButton.classList.add(ADD_BUTTON_CLASS);

    const fauxnLink = fauxnItem.querySelector('a.fauxn-link');
    if (fauxnLink) {
      fauxnLink.appendChild(addButton);
    } else {
      fauxnItem.appendChild(addButton);
    }

    const [brandName, phoneName] = fauxnItem
      .getAttribute('name')
      .split(': ')
      .map((s) => s.trim());
    const siteUrl = fauxnLink ? fauxnLink.href.split('/?share=')[0] + '/' : '';
    const fileName = fauxnLink ? fauxnLink.href.split('/?share=')[1].replace(/_/g, ' ') : '';

    addButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Determine the full identifier
      const fullIdentifier = brandName + ' ' + phoneName;
      // Get the site name suffix from the siteUrl (e.g. from https://harpo.squig.link/ get "Harpo")
      let siteSuffix = "";
      try {
        const urlObj = new URL(siteUrl);
        if (urlObj.hostname.includes('.squig.link')) {
          siteSuffix = urlObj.hostname.split('.')[0];
        } else if (urlObj.pathname.includes('/lab/')) {
          siteSuffix = urlObj.pathname.split('/')[2];
        }
        siteSuffix = siteSuffix.charAt(0).toUpperCase() + siteSuffix.slice(1);
      } catch (e) {
        siteSuffix = "Remote";
      }

      const dispSuffix = `(${siteSuffix})`;

      // If it exists, remove it
      if (DataProvider.isFRDataLoaded(fullIdentifier, dispSuffix)) {
        DataProvider.removeFRData("phone", fullIdentifier);
        addButton.textContent = ADD_SYMBOL;
        return;
      }

      // Try to load external measurement
      try {
        addButton.textContent = '...';
        await this._loadExternalFile(siteUrl, fileName, fullIdentifier, dispSuffix);
        addButton.textContent = REMOVE_SYMBOL;
      } catch (error) {
        console.error('Error loading data for', phoneName, error);
        addButton.textContent = WARNING_SYMBOL;
      }
    });
  }

  async _loadExternalFile(siteUrl, fileName, fullIdentifier, dispSuffix) {
    const channelFiles = [];

    // Make sure we have the exact filename variant from phone_book.json first
    let actualFileNames = await this._findFilesInPhoneBook(siteUrl, fileName);
    if (!actualFileNames || actualFileNames.length === 0) {
      // Fallback to exactly what the link shared if phone_book.json failed
      actualFileNames = [fileName];
    }

    // Try parsing the first valid one we find
    const targetFileBasename = actualFileNames[0];

    for (const channel of ['L', 'R']) {
      const fullFileName = `${targetFileBasename} ${channel}.txt`;
      // fixupUrl logic port from normal SquigLoader
      let dataUrl = `${siteUrl}data/${fullFileName}`;
      if (siteUrl.includes('silicagel') || siteUrl.includes('doltonius')) {
        dataUrl = dataUrl.replace('/data/', '/data/phones/');
      } else if (siteUrl.includes('/hana/')) {
        dataUrl = dataUrl.replace('/data/', '/data/measurements/');
      }

      await this._fetchFile(dataUrl, channelFiles, fullFileName);
    }

    if (channelFiles.length !== 2) {
      throw new Error("Failed to download L and R channels from remote database.");
    }

    // Parse the retrieved text contents using the built in parser
    const leftParsed = await FRParser.parseFRData(channelFiles[0]);
    const rightParsed = await FRParser.parseFRData(channelFiles[1]);

    // Average them like the parser does
    const avgParsed = {
      data: leftParsed.data.map(([freq, lDb], index) => [
        freq,
        (lDb + rightParsed.data[index][1]) / 2
      ]),
      metadata: { ...leftParsed.metadata }
    };

    const combinedParsedObj = {
      L: leftParsed,
      R: rightParsed,
      AVG: avgParsed
    };

    // Insert to Graph
    await DataProvider.insertRawFRData("phone", fullIdentifier, combinedParsedObj, { dispSuffix });
  }

  async _fetchFile(url, channelFiles, fileName) {
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      channelFiles.push(text);
    } else {
      throw new Error(`HTTP error fetching ${url}: ${response.status}`);
    }
  }

  async _findFilesInPhoneBook(siteUrl, fileName) {
    const phoneBookUrl = `${siteUrl}data/phone_book.json`;
    try {
      const response = await fetch(phoneBookUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const phoneBook = await response.json();

      for (const entry of phoneBook) {
        for (const phone of entry.phones) {
          if (phone.file instanceof Array) {
            if (phone.file.includes(fileName)) {
              return phone.file;
            }
          } else {
            if (phone.file === fileName) {
              return [phone.file];
            }
          }
        }
      }
      return [];
    } catch (error) {
      console.warn('Error fetching or parsing remote phone_book.json:', error);
      return [];
    }
  }
}