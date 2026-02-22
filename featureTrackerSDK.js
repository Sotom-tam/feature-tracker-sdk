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
        visitorId:null,
        init:function(config={}){
            if(this.initialised)return;

            this.config=config;
            this.attachListener();
            this.initialised=true;
            this.visitorId=config.visitorId
            console.log(config,config.visitorId)
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
            const element =event.target;
            const selector = getSelectorFingerprint(element);
            const featureKey = hashString(selector);
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
        trackPageViews:function() {
        const self = this;

        // Helper to detect URL changes
        function handleLocationChange() {
            const current = window.location.pathname;
            // Prevent duplicate page events
            if (current !== self.lastPage) {
            self.lastPage = current;
            self.recordPageView();
            }
        }
        // --- Patch pushState ---
        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            originalPushState.apply(this, args);
            handleLocationChange();
        };
        // --- Patch replaceState ---
        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            handleLocationChange();
        };

        // --- Back/forward navigation ---
        window.addEventListener("popstate", handleLocationChange);
        },
        recordPageView:function() {
        const payload = {
            visitorId: this.visitorId || null,
            eventType: "page_view",
            timestamp: Date.now(),
            page: window.location.pathname,
            url: window.location.href
        };
        this.sendEvent(payload);
        },
        sendData:async function(payload){
            try {
                const result=await fetch("http://localhost:4000/api/events",{
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
    
    FeatureTracker.init({visitorId:visitorId})

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
      const cls = el.className.trim().split(/\s+/)[0];
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

function hashString(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // convert to 32-bit int
  }

  return "f_" + Math.abs(hash);
}