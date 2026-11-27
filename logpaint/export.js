const encoder=new TextEncoder();
export function tiff(pixels,width,height,dpi=300){
 const entries=13,ifdEnd=8+2+entries*12+4,bits=ifdEnd,res=bits+6,start=res+16;
 const out=new Uint8Array(start+width*height*3),v=new DataView(out.buffer);out.set([73,73]);v.setUint16(2,42,true);v.setUint32(4,8,true);v.setUint16(8,entries,true);
 const tags=[[256,4,1,width],[257,4,1,height],[258,3,3,bits],[259,3,1,1],[262,3,1,2],[273,4,1,start],[277,3,1,3],[278,4,1,height],[279,4,1,width*height*3],[282,5,1,res],[283,5,1,res+8],[284,3,1,1],[296,3,1,2]];
 tags.forEach(([tag,type,count,value],i)=>{const p=10+i*12;v.setUint16(p,tag,true);v.setUint16(p+2,type,true);v.setUint32(p+4,count,true);if(type===3&&count===1)v.setUint16(p+8,value,true);else v.setUint32(p+8,value,true);});
 for(let i=0;i<3;i++)v.setUint16(bits+i*2,8,true);v.setUint32(res,dpi,true);v.setUint32(res+4,1,true);v.setUint32(res+8,dpi,true);v.setUint32(res+12,1,true);
 for(let i=0,j=start;i<pixels.length;i+=4){out[j++]=pixels[i];out[j++]=pixels[i+1];out[j++]=pixels[i+2];}return new Blob([out],{type:'image/tiff'});
}
export function pdf(pixels,width,height,dpi=300){
 const rgb=new Uint8Array(width*height*3);for(let i=0,j=0;i<pixels.length;i+=4){rgb[j++]=pixels[i];rgb[j++]=pixels[i+1];rgb[j++]=pixels[i+2];}
 const w=width*72/dpi,h=height*72/dpi,content=`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
 const parts=[],offsets=[0];let size=0;const append=b=>{if(typeof b==='string')b=encoder.encode(b);parts.push(b);size+=b.length;};
 append('%PDF-1.4\n');
 const object=(id,body)=>{offsets[id]=size;append(`${id} 0 obj\n${body}\nendobj\n`);};
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
 offsets[4]=size;append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`);append(rgb);append('\nendstream\nendobj\n');object(5,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
 const xref=size;append('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)append(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);return new Blob(parts,{type:'application/pdf'});
}
export async function encodeExport(pixels,width,height,format,dpi){
 if(format==='tiff')return tiff(pixels,width,height,dpi);if(format==='pdf')return pdf(pixels,width,height,dpi);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);
 if(format==='svg'){const image=canvas.toDataURL('image/png');return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>LogPaint raster export</title><desc>Rendered finite view of a scale-invariant painting; embedded raster, not vector strokes.</desc><image width="${width}" height="${height}" xlink:href="${image}"/></svg>`],{type:'image/svg+xml'});}
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoder failed.')),`image/${format}`,0.95));
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
