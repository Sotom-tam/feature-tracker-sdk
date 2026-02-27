
const backendUrl="http://localhost:4000/api/events"

const getData=document.getElementById("getData").addEventListener("click",param)

async function fetchFeatureData(){
    try {
        const response =await fetch(`${backendUrl}/`,{
            method:"GET",
            headers:{"Content-Type": "application/json"},
        })
        if(response.ok){
            const data=await response.json()
            console.log(data)
            return data
        }
    } catch (error) {
       console.log(error) 
    }
    
}

async function param(){
    const data =await fetchFeatureData()||[
    { label: "Feature1", value: 2 },
    { label: "Feature2", value: 5 },
    { label: "Feature3", value: 8 },
    { label: "Feature4", value: 4 },
    { label: "Feature5", value: 3 },];

    const maxValue=Math.max(...data.map((item)=>{return parseInt(item.event_count)}))
    console.log("max value:",maxValue)

    const chartArea   = document.getElementById('chartArea');
    const chartLabels = document.getElementById('chartLabels');
    data.forEach(item => {
    // 2. Calculate height percentage
    const heightPct = (item.event_count / maxValue) * 100;
    console.log("height %:",heightPct)
    // 3. Build bar group
    const group = document.createElement('div');
    group.className = 'bar-group';

    const valueEl = document.createElement('div');
    valueEl.className = 'bar-value';
    valueEl.textContent = item.event_count;

    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'bar';
    // Start at 0, animate to real height on load
    bar.dataset.height = heightPct;

    wrap.appendChild(bar);
    group.appendChild(valueEl);
    group.appendChild(wrap);
    chartArea.appendChild(group);

    // Label row
    const label = document.createElement('span');
    label.textContent = item.feature_name;
    chartLabels.appendChild(label);
  });

  // 4. Trigger CSS height animation after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.bar').forEach(bar => {
        bar.style.height = bar.dataset.height + '%';
      });
    });
  });
}
param()
console.log("yo")