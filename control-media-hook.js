(()=>{
  const previousWrite=document.write.bind(document);
  document.write=function(html){
    if(typeof html==='string'&&html.includes('Birthday Site Control Room')){
      const script='<script src="./control-media-runtime.js?v=13"></'+'script>';
      const i=html.toLowerCase().lastIndexOf('</body>');
      html=i>=0?html.slice(0,i)+script+html.slice(i):html+script;
    }
    return previousWrite(html);
  };
})();
