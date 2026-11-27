// Keep text editing local while a value is incomplete; commit valid input
// through the same event handlers as the slider, including change on blur.
export function setupNumericSliders(onInvalid=()=>{}){
 const pairs=[];
 for(const slider of document.querySelectorAll('input[type=range]')){
  if(document.getElementById(slider.id+'Number'))continue;
  const field=document.createElement('input'),wrap=document.createElement('div');
  field.type='number';field.id=slider.id+'Number';field.min=slider.min;field.max=slider.max;field.step=slider.step||'1';field.value=slider.value;
  field.setAttribute('aria-label',(document.querySelector(`label[for="${slider.id}"]`)?.childNodes[0]?.textContent.trim()||slider.id)+' numeric value');
  wrap.className='range-editor';slider.before(wrap);wrap.append(slider,field);pairs.push([slider,field]);
  const valid=()=>field.value!==''&&Number.isFinite(field.valueAsNumber)&&field.checkValidity();
  const apply=commit=>{if(!valid())return false;slider.value=field.value;slider.dispatchEvent(new Event('input',{bubbles:true}));if(commit)slider.dispatchEvent(new Event('change',{bubbles:true}));return true;};
  field.addEventListener('input',()=>{field.setAttribute('aria-invalid',String(!valid()));apply(false);});
  field.addEventListener('change',()=>{if(!apply(true)){onInvalid(`Enter a value from ${slider.min} to ${slider.max} in steps of ${field.step}.`);field.value=slider.value;}field.setAttribute('aria-invalid','false');});
  field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();field.blur();}if(event.key==='Escape'){field.value=slider.value;field.blur();}});
  slider.addEventListener('input',()=>{if(document.activeElement!==field)field.value=slider.value;});
 }
 return {sync(){for(const [slider,field] of pairs){field.disabled=slider.disabled;if(document.activeElement!==field)field.value=slider.value;}}};
}
