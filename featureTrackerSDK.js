 //script has a dataset that point to the project key of the project saved on the databse
const script=document.getElementById("featureTrackSDK")
const projectKey=script.dataset.projKey;
//to get the icon, or favicon on the
const favicon = document.querySelector("link[rel~='icon']");
const icon=favicon?.href
console.log("icon:",icon)
console.log(projectKey);
//console.log("title:",document.title,"\n Project Key:",projectKey);

const backendUrl=`https://cinanalytics-backend.onrender.com/api`;

(function featureTracker(window){
    const visitorId=getOrCreateUser()
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
    const FeatureTracker={
        initialised:false,
        config:{},
        visitorId:visitorId,
        projectName:document.title,
        projectKey:null,
        projectIcon:icon,
        lastPage:null,
        init:function(config={}){
            if(this.initialised)return;

            this.config = config;
            this.projectKey = config.projectKey;

            this.attachListener();
            this.trackPageViews()
            this.recordPageView({ pageLabel: window.location.pathname, source: "initial_load" });
            this.initialised=true;

            this.sdkInitialised()
            console.log("Initialising")
            console.log(config)
        },
        sdkInitialised:async function(){
            const response =await fetch(`${backendUrl}/project/verify-project`,{
                method:"POST",
                headers:{"Content-type":"application/json"},
                body:JSON.stringify({
                    projectKey:this.projectKey,
                    projectName:this.projectName,
                    projectIcon:this.projectIcon,
                }),
                credentials:"include"
            })
            const data=await response.json()
            console.log("Your feature tracker is ready",data)
        },
        attachListener:function(){
            document.addEventListener("click", this.handleEvent.bind(this), true);
            document.addEventListener("input", this.handleEvent.bind(this), true);
            document.addEventListener("change", this.handleEvent.bind(this), true);
            document.addEventListener("submit", this.handleEvent.bind(this), true);
        },
        handleEvent:function(event){
            //console.log(event)
            const elementData=this.recordEvent(event)
            this.sendData(elementData)
        },
        recordEvent:function(event){
            //console.log(event,event.target)
            const element =event.target;
            if(element===document.body||element.documentElement){

            }
            const selector = getSelectorFingerprint(element);
            const featureKey = hashString(selector,15,"f_");
            const eventData={
                visitorId:this.visitorId||null,
                eventType:element.type,
                innerText:element.innerText,
                parentElement:element.parentElement.tagName,
                tag:element.tagName,
                id:element.id||null,
                classes:element.className||null,
                ariaLabel:element.getAttribute("aria-label")||null,
                role: element.getAttribute("role"),
                name: element.getAttribute("name"),
                page:window.location.pathname,
                baseURL:element.baseURI,
                featureKey:featureKey,
                selectorFingerPrint:selector,
                timeStamp: Date.now()
            }
            console.log("eventData:",eventData)
            return eventData
        },
       trackPageViews: function () {
            const self = this;

            // --- 1. Real URL changes (React Router, Next.js, etc.) ---
            function handleLocationChange() {
                const current = window.location.pathname;
                if (current !== self.lastPage) {
                    self.lastPage = current;
                    self.recordPageView({ pageLabel: current, source: "url_change" });
                }
            }

            const originalPushState = history.pushState;
            history.pushState = function (...args) {
                originalPushState.apply(this, args);
                handleLocationChange();
                };

            const originalReplaceState = history.replaceState;
            history.replaceState = function (...args) {
                originalReplaceState.apply(this, args);
                handleLocationChange();
            };

            window.addEventListener("popstate", handleLocationChange);

                        // --- 2. DOM-swap SPAs (innerHTML replacement, no URL change) ---
                        // We watch the whole body, since we don't know which container the app uses
                        // --- 2. DOM-swap SPAs (innerHTML replacement, no URL change) ---
            function startBodyObserver() {
                const observer = new MutationObserver(() => {
                    const current = window.location.pathname;
                    const heading = document.querySelector("main h1, main h2, #content h2, [data-page]");
                    const signature = (current + "::" + (heading?.innerText?.trim() || "")).toLowerCase();

                    if (signature !== self.lastPage) {
                        self.lastPage = signature;
                        self.recordPageView({
                            pageLabel: heading?.innerText?.trim() || current,
                            source: "dom_mutation"
                        });
                    }
                });

                observer.observe(document.body, {  // body is guaranteed to exist now
                    childList: true,
                    subtree: true
                });
            }

            // If DOM is already ready, run immediately — otherwise wait
            if (document.body) {
                startBodyObserver();
            } else {
                document.addEventListener("DOMContentLoaded", startBodyObserver);
            };
        },
        recordPageView: function ({ pageLabel, source } = {}) {
            const payload = {
                visitorId: this.visitorId || null,
                eventType: "page_view",
                pageLabel: pageLabel || window.location.pathname,
                source: source || "initial_load",   // "url_change" | "dom_mutation" | "initial_load"
                timestamp: Date.now(),
                page: window.location.pathname,
                url: window.location.href,
                projectKey: this.projectKey,
            };
            console.log("Page view:", payload);
            this.sendData(payload);
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

function hashString(str,strLength,strIden) {
    const hash=btoa(str).slice(0,strLength)
    //console.log("btoaHarsh:",hash)
    return `${strIden}` + hash;
}



