// The server draws the QR in navy (#0B1F3A). On screen we want pure black on pure white for the
// best contrast, so the page swaps only that colour in the SVG text. The modules (the code itself)
// and the quiet zone are unchanged; nothing about the QR logic changes.
const PREFIX='data:image/svg+xml;base64,';
export function pureBlackQr(dataUrl?:string):string|undefined{
  if(!dataUrl||!dataUrl.startsWith(PREFIX))return dataUrl;
  try{return PREFIX+btoa(atob(dataUrl.slice(PREFIX.length)).replace(/#0B1F3A/gi,'#000000'));}
  catch{return dataUrl;}
}
