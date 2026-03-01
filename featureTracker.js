const script=document.getElementById("featureTrackSDK")
const projectKey=script?.dataset?.projKey|| "demoProjectKey1234";

const favicon = document.querySelector("link[rel~='icon']");
const icon=favicon?.href
console.log("icon:",icon);

const backendUrl="https://cinanalytics-backend.onrender.com/api";

(function featureTracker(){
    const FeatureTracker={
        initiliased:false,
        config:{},
        visitorId:getOrCreateUser(),
        projectKey:null,
        projectIcon:icon,
         /** The last recorded pathname + hash, used for de-duplication */
        lastRecordedPath: null,
        /** MutationObserver watching for SPA DOM swaps (React / Vue / Angular) */
        mutationObserver: null,
        /** Timestamp of last pushState/replaceState call to suppress duplicate MutationObserver fires */
        lastHistoryChange: 0,
        init:function(config={}){
            //this function should only run on the first load
            if(this.initialised)return;
            //values to set on first load
            this.config = config;
            this.projectKey = config.projectKey||null;

            if ((!this.projectKey)||this.projectKey==="demoProjectKey1234") {
                console.warn("[FeatureTracker] Initialisation failed: no projectKey provided. Tracking disabled.");
                return; // never sets this.initialised = true, so init() could be retried
            }

            //functions to call on first load
            this.attachListener();
            this.patchHistory();       // intercept pushState / replaceState
            this.listenHashChange();   // hash-router support  (#/route)
            this.listenPopState();     // browser back / forward
            // After (waits for DOM if script is in <head>)
            if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                this.observeDOMForSPAs();
                this.trackPageView("initial");
            }, { once: true });
            } else {
            this.observeDOMForSPAs(); // DOM already ready (deferred/async/end of body)
            this.trackPageView("initial");
            }
            //setting intiliased to true
            this.initiliased=true;
            console.log("Initialising")
            console.log(config)
        },
        sdkInitialised:async function(){
            const response =await fetch(`${backendUrl}/project/verify-project`,{
                method:"POST",
                headers:{"Content-type":"application/json"},
                body:JSON.stringify({
                    projectKey:this.projectKey,
                    projectIcon:this.projectIcon,
                }),
                credentials:"include"
            })
            const data=await response.json()
            console.log("Your feature tracker is ready",data)
        },
        attachListener:function(){//This function attaches listeners to document to catch events
            document.addEventListener("click", this.handleEvent.bind(this), true);
            document.addEventListener("submit", this.handleEvent.bind(this), true);
        },
        handleEvent:function(event){
            //console.log(event)
            const elementData=this.recordEvent(event)
            this.sendData(elementData)
        },
        recordEvent:function(event){
            const eventType=event.type;
            const element=event.target
            //We only want to record events that are tied to features
            //the elements listed here are the ones that are tied to features
            const interactiveElement=element.closest('button, div, a, input, select, textarea, form, [role="button"], [onclick]');
            if(!interactiveElement){return;}//don't record if it isn't an "interactive element" 
            //we need to know which feature the element is tied to
            //we can do this by getting the container that feature is in
            const container=findFeatureContainer(element)
            //get fingerprint of container  (tells us where this element is in document)
            const containerFingerPrint=getSelectorFingerprint(container)
            //same feature container should have thesame key
            const featureKey=hashString(containerFingerPrint,"feat_")
            const featurName=formatFeatureName(inferFeatureName(container))
            const eventData={
                projectKey:this.projectKey,
                visitorId:this.visitorId,
                eventType,
                tag:element.tagName,
                innerText:element.innerText?.trim().slice(0,30),                
                id:element.id||null,
                classes:element.className||null,
                ariaLabel:element.getAttribute("aria-label")||null,
                role: element.getAttribute("role"),
                name: element.getAttribute("name"),
                featureKey:featureKey,
                featureName:featurName,
                containerTag:container?.tagName,
                containerId:container?.id,
                containerClasses:container?.className,
                containerSelectorFingerPrint:containerFingerPrint,
                path: window.location.pathname,
                url: window.location.href,
                title: document.title,
                timestamp: Date.now()
            }
            console.log("Event Captured:",eventData)
            return eventData
        },
        trackPageView: function (source) {
        const currentPath = window.location.pathname + window.location.hash;
        // De-duplicate: don't fire twice for the same path
        if (source !== "initial" && currentPath === this.lastRecordedPath) return;
        this.lastRecordedPath = currentPath;

        const eventData = {
            projectKey: this.projectKey,
            visitorId:  this.visitorId,
            eventType:  "pageview",
            page: {
            path:  window.location.pathname,
            hash:  window.location.hash,
            url:   window.location.href,
            title: document.title,
            },
            source,
            timestamp: Date.now(),
        };

        console.log("[FeatureTracker] Page View:", eventData);
        this.sendData(eventData);
        },
        patchHistory: function () {
        const self = this;
        function wrapHistoryMethod(methodName) {
            const original = history[methodName];
            history[methodName] = function (...args) {
            original.apply(this, args);
            self.lastHistoryChange = Date.now();
            // Use a tiny timeout so the new URL has time to settle
            // and document.title has been updated by the framework
            setTimeout(() => self.trackPageView(methodName), 0);
            };
        }
        wrapHistoryMethod("pushState");
        wrapHistoryMethod("replaceState");
        },
        // ── Route-Change Detection: browser back / forward ────────────────────
        listenPopState: function () {
        window.addEventListener("popstate", () => {
            setTimeout(() => this.trackPageView("popstate"), 0);
        });
        },
        listenHashChange: function () {
            window.addEventListener("hashchange", () => {
            this.trackPageView("hashchange");
            });
        },
        observeDOMForSPAs: function () {
            const self = this;
            let debounceTimer = null;
            // Find the most likely SPA mount point
            const mountPoint =
                document.getElementById("root") ||   // React (CRA / Vite)
                document.getElementById("app") ||    // Vue CLI / custom
                document.getElementById("__next") || // Next.js
                document.getElementById("content") || // index.html demo style
                document.body;

            this.mutationObserver = new MutationObserver(() => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                const currentPath = window.location.pathname + window.location.hash;

                // Skip if path hasn't changed (e.g. just a UI re-render on the same route)
                if (currentPath === self.lastRecordedPath) return;

                // Skip if a history method fired very recently — it already handled this
                if (Date.now() - self.lastHistoryChange < 500) return;

                // We have a genuine DOM-driven route change not caught by history patching
                self.trackPageView("mutation");
                }, 200);
            });

            this.mutationObserver.observe(mountPoint, {
                childList: true,  // direct children added/removed
                subtree: true,    // deep changes
            });
        }, 
        sendData:async function(payload){

            try {
                const result=await fetch(`${backendUrl}/events`,{
                method:"POST",
                headers:{"Content-Type": "application/json"},
                body:JSON.stringify(payload),
                keepalive:true,
                })
                console.log(result) 
            } catch (error) {
                console.log(error)
            }
            
        }

    }

    window.FeatureTracker=FeatureTracker;
    FeatureTracker.init({
        projectKey:projectKey
    })
})(window)

function getOrCreateUser(){
    const STORAGE_KEY="fk_visitor_id"
    let id=localStorage.getItem(STORAGE_KEY)
    //checking id id exist
    //creating a new id
    if(!id){
        id = "v_" + Math.random().toString(12).slice(2) + Date.now();
        localStorage.setItem(STORAGE_KEY, id);
    }
    return id
}

function findFeatureContainer(element) {
    if (!element) return null;

    let current = element;
    let depth = 0;

    const MAX_DEPTH = 6; // prevent climbing entire page

    while (current&&current!== document.body&&depth < MAX_DEPTH) {

        //1STRONGEST SIGNAL: Explicit developer tagging
        //If developer adds: <div data-feature="search-bar">
        //We immediately trust it.
        if (current.hasAttribute("data-feature")) {
            return current;
        }
        //SEMANTIC CONTAINERS
        //These HTML elements usually represent logical features
        const semanticTags = ["FORM", "NAV", "SECTION", "ARTICLE", "ASIDE", "MAIN"];
        if (semanticTags.includes(current.tagName)) {
            return current;
        }
        //HEURISTIC STRUCTURAL DETECTION
        //We try to detect UI components based on structure.
        // Count interactive children
        const interactiveChildren =current.querySelectorAll("button, a, input, select, textarea, [role='button']").length;
        // Heuristic rule:
        // - Must have class name (not plain div)
        // - Must contain at least 2 interactive elements
        // - Should not be too large (avoid grouping whole page)
        if (current.className &&typeof current.className === "string" &&interactiveChildren >= 2 &&current.children.length <= 20) {
            return current;
        }
        // Move up one level
        current = current.parentElement;
        depth++;
    }


    //If nothing suitable found, return original element
    return element;
}

function inferFeatureName(container) {
    if (!container) return "unknown";

    return (
        container.getAttribute("data-feature") ||
        container.id ||
        (typeof container.className === "string"
            ? container.className.split(" ")[0]
            : null) ||
        container.getAttribute("aria-label") ||
        container.getAttribute("role") ||
        container.tagName.toLowerCase()
    );
}
function formatFeatureName(raw) {
  if (!raw) return "Unknown";

  return raw
    // camelCase → "camel Case"
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // kebab-case and snake_case → spaces
    .replace(/[-_]/g, " ")
    // Capitalise every word
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
function getSelectorFingerprint(el) {
  const path = [];

  while (el && el.nodeType === 1 && el !== document.body) {
    let selector = el.tagName.toLowerCase();
    // prefer stable id
    if (el.id) {
      selector += "#" + el.id;
      path.unshift(selector);
      break; // id is unique enough
    }

    // fallback to class
    if (el.className && typeof el.className === "string") {
        //console.log("class name:",el.className)
        //if element has multiple classnames we split them using the whitespace \s and + if there's more than one
        const cls = el.className.trim().split(/\s+/)[0];//split might give us and array of each classname so we take the first one
        if (cls) selector += "." + cls;
    }

    // fallback to position
    const parent = el.parentNode;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === el.tagName
      );

      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    el = el.parentElement;
  }

  return path.join(" > ");
}

function hashString(str,strStart) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  // base36 string, pad to 12 characters (between 10–15)
  return strStart+ hash.toString(36).padEnd(12, "0");
}