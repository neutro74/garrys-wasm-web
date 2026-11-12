// Bounded render-worker completion intervals. Includes stalls; the caller chooses warmup.
// Completion means submitted to WebGL, not proof of physical display scanout.
export class FrameMetrics {
  constructor(capacity=900) { this.times=new Float64Array(capacity);this.count=0;this.next=0;this.last=null; }
  record(now) {
    if(this.last!==null) { this.times[this.next]=now-this.last;this.next=(this.next+1)%this.times.length;this.count=Math.min(this.count+1,this.times.length); }
    this.last=now;
  }
  snapshot() {
    const values=Array.from(this.times.subarray(0,this.count)).sort((a,b)=>a-b);
    const percentile=q=>values[Math.max(0,Math.ceil(values.length*q)-1)]??0;
    const total=values.reduce((a,b)=>a+b,0);
    return {frames:this.count,fps:total?1000*this.count/total:0,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:values.at(-1)??0,
      overBudget:values.filter(t=>t>1000/30+1).length};
  }
}
