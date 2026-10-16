'use client';
// The camera scanner inside the website. It uses the Html5Qrcode class (camera only).
// Html5QrcodeScanner is avoided on purpose: its built-in UI also offers "scan an image file",
// which would let a student scan a forwarded screenshot instead of the live screen.
import {useEffect,useRef} from 'react';

export type ScannerProblem='denied'|'no_camera'|'insecure'|'failed';
const ELEMENT_ID='eui-qr-reader';

// Turns the browser's camera error into one of four plain cases.
function classify(err:unknown):ScannerProblem{
  const text=String((err as {name?:string})?.name||'')+' '+String(err);
  if(/NotAllowed|Permission|denied/i.test(text))return 'denied';
  if(/NotFound|NotReadable|Overconstrained|no camera|Requested device not found/i.test(text))return 'no_camera';
  return 'failed';
}

// While `active` is true the camera runs; setting it to false (or leaving the page) stops it.
// Only payloads that start with "EUIA1." are passed to onCode; any other QR code is ignored.
export function QrScanner({active,onCode,onOtherCode,onProblem}:{active:boolean,onCode:(payload:string)=>void,onOtherCode:()=>void,onProblem:(p:ScannerProblem)=>void}){
  // Refs keep the latest callbacks without restarting the camera on every render.
  const handlers=useRef({onCode,onOtherCode,onProblem});
  handlers.current={onCode,onOtherCode,onProblem};
  // A restart must wait until the previous camera has fully stopped (both use the same element).
  const stopping=useRef<Promise<void>>(Promise.resolve());
  useEffect(()=>{
    if(!active)return;
    let cancelled=false;
    let scanner:import('html5-qrcode').Html5Qrcode|null=null;
    let starting:Promise<unknown>|null=null;
    (async()=>{
      // Browsers only allow the camera on https:// pages (localhost counts as secure).
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){handlers.current.onProblem('insecure');return;}
      const {Html5Qrcode,Html5QrcodeSupportedFormats}=await import('html5-qrcode'); // loaded only in the browser
      await stopping.current;
      if(cancelled)return;
      scanner=new Html5Qrcode(ELEMENT_ID,{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE],verbose:false});
      starting=scanner.start({facingMode:'environment'},
        {fps:10,qrbox:(w,h)=>{const side=Math.floor(Math.min(w,h)*0.78);return {width:side,height:side};}},
        (text)=>{if(text.startsWith('EUIA1.'))handlers.current.onCode(text);else handlers.current.onOtherCode();},
        ()=>{/* no QR code in this video frame */});
      try{await starting;}catch(err){if(!cancelled)handlers.current.onProblem(classify(err));}
    })();
    return ()=>{
      cancelled=true;
      // Wait for a start that is still in progress, then stop the camera and remove the video.
      stopping.current=(async()=>{
        try{await starting;}catch{/* start failed: nothing to stop */}
        try{if(scanner?.isScanning)await scanner.stop();scanner?.clear();}catch{/* already stopped */}
      })();
    };
  },[active]);
  return <div id={ELEMENT_ID} className="scanner-view" aria-label="Camera view for scanning the attendance QR"/>;
}
