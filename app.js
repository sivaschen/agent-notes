(function(){
  var root=document.documentElement, KEY='agent-notes-theme';
  var saved=localStorage.getItem(KEY); if(saved) root.setAttribute('data-theme',saved);
  document.getElementById('themeBtn').onclick=function(){
    var dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme: dark)').matches);
    var t=dark?'light':'dark'; root.setAttribute('data-theme',t); localStorage.setItem(KEY,t);
  };
  var nav=document.querySelector('nav.side');
  document.getElementById('menuBtn').onclick=function(){nav.classList.toggle('open')};
  nav.addEventListener('click',function(e){if(e.target.closest('a')&&innerWidth<=860)nav.classList.remove('open')});
  document.addEventListener('click',function(e){if(innerWidth<=860&&nav.classList.contains('open')&&!e.target.closest('nav.side,#menuBtn'))nav.classList.remove('open')});
  document.getElementById('toTop').onclick=function(){scrollTo(0,0)};

  // 目录：自动根据 h2/h3 生成
  var sections=[].slice.call(document.querySelectorAll('section.topic'));
  var html='<a href="#dashboard" class="toc-dash">📊 学习进度</a>';
  sections.forEach(function(s){
    var h=s.querySelector('h2'); var title=h.firstChild.textContent.trim();
    html+='<div class="toc-group"><a href="#'+s.id+'" data-sec="'+s.id+'">'+title+'</a><div class="toc-subs">';
    [].slice.call(s.querySelectorAll('h3[id], h4[id]')).forEach(function(h3){html+='<a class="sub" href="#'+h3.id+'" data-sec="'+s.id+'">'+h3.textContent+'</a>'});
    html+='</div></div>';
  });
  document.getElementById('toc').innerHTML=html;

  var links=[].slice.call(document.querySelectorAll('#toc a[data-sec]:not(.sub)'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){var on=a.dataset.sec===e.target.id;a.classList.toggle('active',on);a.parentNode.classList.toggle('open',on)})}})},{rootMargin:'-60px 0px -70% 0px'});
    sections.forEach(function(s){io.observe(s)});
  }

  // 搜索：过滤章节、高亮命中；搜索时卡片切到列表模式，方便看到命中内容
  var input=document.getElementById('search'), noRes=document.getElementById('noResult');
  function clearMarks(){[].slice.call(document.querySelectorAll('main mark.sm')).forEach(function(m){var p=m.parentNode;p.replaceChild(document.createTextNode(m.textContent),m);p.normalize()})}
  function skip(n){return n.parentNode.closest('script,style,svg,.widget,textarea,button')}
  function markIn(el,q){
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false),nodes=[],n;
    while(n=w.nextNode()){if(skip(n))continue;if(n.nodeValue.toLowerCase().indexOf(q)>-1)nodes.push(n)}
    nodes.forEach(function(t){
      var txt=t.nodeValue,low=txt.toLowerCase(),i=0,j,frag=document.createDocumentFragment();
      while((j=low.indexOf(q,i))>-1){frag.appendChild(document.createTextNode(txt.slice(i,j)));var m=document.createElement('mark');m.className='sm';m.textContent=txt.slice(j,j+q.length);frag.appendChild(m);i=j+q.length}
      frag.appendChild(document.createTextNode(txt.slice(i)));t.parentNode.replaceChild(frag,t);
    });
  }
  function text(s){var t='',w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT,null,false),n;while(n=w.nextNode()){if(!skip(n))t+=n.nodeValue+' '}return t.toLowerCase()}
  var timer;
  input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,200)});
  function run(){
    clearMarks(); var q=input.value.trim().toLowerCase(), shown=0;
    document.body.classList.toggle('searching',!!q);
    sections.forEach(function(s){
      var hit=!q||text(s).indexOf(q)>-1;
      s.classList.toggle('hidden',!hit);
      [].slice.call(document.querySelectorAll('#toc a[data-sec="'+s.id+'"]')).forEach(function(a){a.style.display=hit?'':'none'});
      if(hit){shown++; if(q){window.AN&&AN.expand(s);markIn(s,q)}}
    });
    noRes.style.display=shown?'none':'block';
  }
  document.addEventListener('keydown',function(e){if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();input.focus()}});
})();
