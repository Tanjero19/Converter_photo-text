const file=document.getElementById('file'),
      drop=document.getElementById('drop'),
      pick=document.getElementById('pick'),
      cv=document.getElementById('cv'),
      ctx=cv.getContext('2d'),
      run=document.getElementById('run'),
      reset=document.getElementById('reset'),
      lang=document.getElementById('lang'),
      psm=document.getElementById('psm'),
      hq=document.getElementById('hq'),
      progBox=document.getElementById('progBox'),
      bar=document.getElementById('bar'),
      note=document.getElementById('note'),
      out=document.getElementById('out'),
      copy=document.getElementById('copy');

let img=null, busy=false;

pick.onclick=()=>file.click();
file.onchange=e=>loadImg(e.target.files[0]);

['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('drag')}))
;['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('drag')}))
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadImg(f)});

// Вставка из буфера обмена (Ctrl/⌘+V)
window.addEventListener('paste',handlePaste);
drop.addEventListener('paste',handlePaste);
function handlePaste(e){
  const dt=e.clipboardData || window.clipboardData;
  if(!dt) return;
  const items=dt.items || [];
  for(const it of items){
    if(it.type && it.type.startsWith('image/')){
      const f=it.getAsFile();
      if(f){ loadImg(f); e.preventDefault(); flashDrop(); }
      return;
    }
  }
  // Поддержка data URL (если скопирован base64)
  const txt=dt.getData && (dt.getData('text/plain')||'');
  if(/^data:image\/(png|jpe?g|gif|webp);base64,/.test(txt)){
    fetch(txt).then(r=>r.blob()).then(b=>loadImg(new File([b],'pasted.png',{type:b.type||'image/png'}))).catch(()=>{});
    e.preventDefault(); flashDrop();
  }
}
function flashDrop(){ drop.classList.add('drag'); setTimeout(()=>drop.classList.remove('drag'),350); }

reset.onclick=()=>{file.value='';img=null;cv.hidden=true;ctx.clearRect(0,0,cv.width,cv.height);out.value='';bar.style.width='0%';progBox.hidden=true;note.textContent='';};

copy.onclick=async()=>{if(!out.value.trim())return;try{await navigator.clipboard.writeText(out.value);copy.textContent='Скопировано ✅';setTimeout(()=>copy.textContent='Скопировать',1200);}catch{alert('Не удалось скопировать')}};

run.onclick=()=>recognize();

function loadImg(f){
  if(!f||!f.type.startsWith('image/'))return;
  const r=new FileReader();
  r.onload=()=>{img=new Image();img.onload=()=>{draw(img);};img.src=r.result;};
  r.readAsDataURL(f);
}

function draw(image){
  const maxW=1800,maxH=1800,ratio=Math.min(maxW/image.width,maxH/image.height,1);
  cv.width=Math.round(image.width*ratio);cv.height=Math.round(image.height*ratio);
  ctx.drawImage(image,0,0,cv.width,cv.height);
  if(hq.checked)enhance(cv,ctx);
  cv.hidden=false;
}

function enhance(canvas,ctx){
  const id=ctx.getImageData(0,0,canvas.width,canvas.height),d=id.data;
  const C=30,cf=(259*(C+255))/(255*(259-C));
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    let y=0.299*r+0.587*g+0.114*b;
    y=cf*(y-128)+128;y=y<0?0:y>255?255:y;
    d[i]=d[i+1]=d[i+2]=y;
  }
  ctx.putImageData(id,0,0);
}

async function recognize(){
  if(busy)return; if(!img){alert('Сначала загрузите изображение 🙂');return;}
  busy=true; run.disabled=reset.disabled=true; progBox.hidden=false; out.value='';
  const opts={logger:m=>{if(m.status){note.textContent=m.status}if(m.progress!=null){bar.style.width=Math.round(m.progress*100)+'%';}},"tessedit_pageseg_mode":Number(psm.value),"preserve_interword_spaces":"1"};
  try{
    const res=await Tesseract.recognize(cv,lang.value,opts);
    let text=res.data.text||'';
    if(hq.checked && text.trim().length<5){
      opts["tessedit_pageseg_mode"]=7;
      const res2=await Tesseract.recognize(cv,lang.value,opts);
      if((res2.data.text||'').length>text.length) text=res2.data.text;
    }
    out.value=text.trim();
    if(!out.value) out.placeholder="Ничего не найдено. Попробуйте другой PSM, язык или включить усиление.";
  }catch(e){console.error(e);alert('Ошибка распознавания. Проверьте подключение и попробуйте снова.')}
  finally{busy=false; run.disabled=reset.disabled=false; note.textContent='Готово'; bar.style.width='100%'; setTimeout(()=>progBox.hidden=true,800);}
}