(function(){
  var root=document.documentElement, KEY='agent-notes-theme';
  var saved=localStorage.getItem(KEY); if(saved) root.setAttribute('data-theme',saved);
  document.getElementById('themeBtn').onclick=function(){
    var dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme: dark)').matches);
    var t=dark?'light':'dark'; root.setAttribute('data-theme',t); localStorage.setItem(KEY,t);
  };
  var nav=document.querySelector('nav.side');
  document.getElementById('menuBtn').onclick=function(){nav.classList.toggle('open')};
  nav.addEventListener('click',function(e){if(e.target.tagName==='A'&&innerWidth<=860)nav.classList.remove('open')});
  document.getElementById('toTop').onclick=function(){scrollTo(0,0)};

  // 目录：自动根据 h2/h3 生成
  var sections=[].slice.call(document.querySelectorAll('section.topic'));
  var html='';
  sections.forEach(function(s){
    var h=s.querySelector('h2'); html+='<a href="#'+s.id+'" data-sec="'+s.id+'">'+h.textContent+'</a>';
    [].slice.call(s.querySelectorAll('h3[id]')).forEach(function(h3){html+='<a class="sub" href="#'+h3.id+'" data-sec="'+s.id+'">'+h3.textContent+'</a>'});
  });
  document.getElementById('toc').innerHTML=html;

  // 当前位置高亮
  var links=[].slice.call(document.querySelectorAll('#toc a:not(.sub)'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.toggle('active',a.dataset.sec===e.target.id)})}})},{rootMargin:'-60px 0px -70% 0px'});
    sections.forEach(function(s){io.observe(s)});
  }

  // 搜索：按关键词过滤章节，并高亮、展开命中的追问
  var input=document.getElementById('search'), noRes=document.getElementById('noResult');
  function clearMarks(){[].slice.call(document.querySelectorAll('main mark')).forEach(function(m){var p=m.parentNode;p.replaceChild(document.createTextNode(m.textContent),m);p.normalize()})}
  function markIn(el,q){
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false),nodes=[],n;
    while(n=w.nextNode()){if(n.parentNode.closest('script,style'))continue;if(n.nodeValue.toLowerCase().indexOf(q)>-1)nodes.push(n)}
    nodes.forEach(function(t){
      var txt=t.nodeValue,low=txt.toLowerCase(),i=0,j,frag=document.createDocumentFragment();
      while((j=low.indexOf(q,i))>-1){frag.appendChild(document.createTextNode(txt.slice(i,j)));var m=document.createElement('mark');m.textContent=txt.slice(j,j+q.length);frag.appendChild(m);i=j+q.length}
      frag.appendChild(document.createTextNode(txt.slice(i)));t.parentNode.replaceChild(frag,t);
    });
  }
  var timer;
  input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,200)});
  function run(){
    clearMarks(); var q=input.value.trim().toLowerCase(), shown=0;
    sections.forEach(function(s){
      var hit=!q||s.textContent.toLowerCase().indexOf(q)>-1;
      s.classList.toggle('hidden',!hit);
      links.concat([].slice.call(document.querySelectorAll('#toc a.sub'))).forEach(function(a){if(a.dataset.sec===s.id)a.style.display=hit?'':'none'});
      if(hit){shown++; if(q){markIn(s,q);[].slice.call(s.querySelectorAll('details')).forEach(function(d){if(d.textContent.toLowerCase().indexOf(q)>-1)d.open=true})}}
    });
    noRes.style.display=shown?'none':'block';
  }
  // 快捷键：按 / 聚焦搜索框
  document.addEventListener('keydown',function(e){if(e.key==='/'&&document.activeElement!==input){e.preventDefault();input.focus()}});
})();
