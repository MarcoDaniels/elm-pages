const elmPagesVersion = require("./package.json").version;

let prefetchedPages;
let initialLocationHash;
let elmViewRendered = false;
let headTagsAdded = false;

module.exports = function pagesInit(
  /** @type { mainElmModule: { init: any  } } */ { mainElmModule }
) {
  prefetchedPages = [window.location.pathname];
  initialLocationHash = document.location.hash.replace(/^#/, "");

  return new Promise(function (resolve, reject) {
    document.addEventListener("DOMContentLoaded", _ => {
      new MutationObserver(function () {
        elmViewRendered = true;
        if (headTagsAdded) {
          document.dispatchEvent(new Event("prerender-trigger"));
        }
      }).observe(
        document.body,
        { attributes: true, childList: true, subtree: true }
      );

      loadContentAndInitializeApp(mainElmModule).then(resolve, reject);
    });
  })
};

function loadContentAndInitializeApp(/** @type { init: any  } */ mainElmModule) {
  const isPrerendering = navigator.userAgent.indexOf("Headless") >= 0
  const path = window.location.pathname.replace(/(\w)$/, "$1/")

  return Promise.all([
    getConfig(),
    httpGet(`${window.location.origin}${path}content.json`)]).then(function (/** @type {[DevServerConfig?, JSON]} */[devServerConfig, contentJson]) {
      const app = mainElmModule.init({
        flags: {
          secrets: null,
          baseUrl: isPrerendering
            ? window.location.origin
            : document.baseURI,
          isPrerendering: isPrerendering,
          isDevServer: !!module.hot,
          isElmDebugMode: devServerConfig ? devServerConfig.elmDebugger : false,
          contentJson,
        }
      });

      app.ports.toJsPort.subscribe((
      /** @type { { head: SeoTag[], allRoutes: string[] } }  */ fromElm
      ) => {
        appendTag({
          type: 'head',
          name: "meta",
          attributes: [
            ["name", "generator"],
            ["content", `elm-pages v${elmPagesVersion}`]
          ]
        });

        window.allRoutes = fromElm.allRoutes.map(route => new URL(route, document.baseURI).href);

        if (navigator.userAgent.indexOf("Headless") >= 0) {
          fromElm.head.forEach(headTag => {
            if (headTag.type === 'head') {
              appendTag(headTag);
            } else if (headTag.type === 'json-ld') {
              appendJsonLdTag(headTag);
            } else {
              throw new Error(`Unknown tag type #{headTag}`)
            }
          });
          headTagsAdded = true;
          if (elmViewRendered) {
            document.dispatchEvent(new Event("prerender-trigger"));
          }
        } else {
          setupLinkPrefetching();
        }
      });


      if (module.hot) {
        // found this trick in the next.js source code
        // https://github.com/zeit/next.js/blob/886037b1bac4bdbfeb689b032c1612750fb593f7/packages/next/client/dev/error-overlay/eventsource.js
        // https://github.com/zeit/next.js/blob/886037b1bac4bdbfeb689b032c1612750fb593f7/packages/next/client/dev/dev-build-watcher.js
        // more details about this API at https://www.html5rocks.com/en/tutorials/eventsource/basics/
        let source = new window.EventSource('/__webpack_hmr')
        source.addEventListener('message', (e) => {
          // console.log('message!!!!!', e)
          // console.log(e.data.action)
          // console.log('ACTION', e.data.action);
          // if (e.data && e.data.action)

          if (event.data === '\uD83D\uDC93') {
            // heartbeat
          } else {
            const obj = JSON.parse(event.data)
            // console.log('obj.action', obj.action);

            if (obj.action === 'building') {
              app.ports.fromJsPort.send({ action: 'hmr-check' });
            } else if (obj.action === 'built') {

              let currentPath = window.location.pathname.replace(/(\w)$/, "$1/")
              httpGet(`${window.location.origin}${currentPath}content.json`).then(function (/** @type JSON */ contentJson) {

                app.ports.fromJsPort.send({ contentJson: contentJson });
              });
            }

          }
        })

      }

      return app
    });
}

function setupLinkPrefetching() {
  new MutationObserver(observeFirstRender).observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

function loadNamedAnchor() {
  if (initialLocationHash !== "") {
    const namedAnchor = document.querySelector(
      `[name=${initialLocationHash}]`
    );
    namedAnchor && namedAnchor.scrollIntoView();
  }
}

function observeFirstRender(
  /** @type {MutationRecord[]} */ mutationList,
  /** @type {MutationObserver} */ firstRenderObserver
) {
  loadNamedAnchor();
  for (let mutation of mutationList) {
    if (mutation.type === "childList") {
      setupLinkPrefetchingHelp();
    }
  }
  firstRenderObserver.disconnect();
  new MutationObserver(observeUrlChanges).observe(document.body.children[0], {
    attributes: true,
    childList: false,
    subtree: false
  });
}

function observeUrlChanges(
  /** @type {MutationRecord[]} */ mutationList,
  /** @type {MutationObserver} */ _theObserver
) {
  for (let mutation of mutationList) {
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "data-url"
    ) {
      setupLinkPrefetchingHelp();
    }
  }
}

function setupLinkPrefetchingHelp(
  /** @type {MutationObserver} */ _mutationList,
  /** @type {MutationObserver} */ _theObserver
) {
  const links = document.querySelectorAll("a");
  links.forEach(link => {
    // console.log(link.pathname);
    link.addEventListener("mouseenter", function (event) {
      if (
        event &&
        event.target &&
        event.target instanceof HTMLAnchorElement
      ) {
        prefetchIfNeeded(event.target);
      } else {
        // console.log("Couldn't prefetch with event", event);
      }
    });
  });
}

function prefetchIfNeeded(/** @type {HTMLAnchorElement} */ target) {
  if (target.host === window.location.host) {
    if (prefetchedPages.includes(target.pathname)) {
      // console.log("Already preloaded", target.href);
      // console.log("Not a known route, skipping preload", target.pathname);
    } else if (!allRoutes.includes(new URL(target.pathname, document.baseURI).href)) {
    }
    else {
      prefetchedPages.push(target.pathname);
      // console.log("Preloading...", target.pathname);
      const link = document.createElement("link");
      link.setAttribute("as", "fetch");

      link.setAttribute("rel", "prefetch");
      if (target.pathname.slice(-1) === "/") {
        link.setAttribute("href", origin + target.pathname + "content.json");
      } else {
        link.setAttribute("href", origin + target.pathname + "/content.json");
      }
      document.head.appendChild(link);
    }
  }
}

/** @typedef {HeadTag | JsonLdTag} SeoTag */

/** @typedef {{ name: string; attributes: string[][]; type: 'head' }} HeadTag */
function appendTag(/** @type {HeadTag} */ tagDetails) {
  const meta = document.createElement(tagDetails.name);
  tagDetails.attributes.forEach(([name, value]) => {
    meta.setAttribute(name, value);
  });
  document.getElementsByTagName("head")[0].appendChild(meta);
}

/** @typedef {{ contents: Object; type: 'json-ld' }} JsonLdTag */
function appendJsonLdTag(/** @type {JsonLdTag} */ tagDetails) {
  let jsonLdScript = document.createElement('script');
  jsonLdScript.type = "application/ld+json";
  jsonLdScript.innerHTML = JSON.stringify(tagDetails.contents);
  document.getElementsByTagName("head")[0].appendChild(jsonLdScript);
}

function httpGet(/** @type string */ theUrl) {
  return new Promise(function (resolve, reject) {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        resolve(JSON.parse(xmlHttp.responseText));
    }
    xmlHttp.onerror = reject;
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
  })
}

/**
* @returns { Promise<DevServerConfig?>}
*/
function getConfig() {
  if (module.hot) {
    return httpGet(`/elm-pages-dev-server-options`)
  } else {
    return Promise.resolve(null)
  }
}

/** @typedef { {  elmDebugger : boolean } } DevServerConfig */
