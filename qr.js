// Minimal QR Code generator — Mode Byte, Version 1–3, Mask 0
// Produces clean SVG strings. No external dependencies.

window.makeQRSVG = function(text, px) {
  px = px || 200;

  // ── Reed-Solomon GF(256) ──
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function(){
    var x=1;
    for(var i=0;i<255;i++){
      EXP[i]=x; LOG[x]=i;
      x<<=1; if(x&256) x^=285;
    }
    for(var j=255;j<512;j++) EXP[j]=EXP[j-255];
  })();

  function gfMul(a,b){ return (a&&b)?EXP[LOG[a]+LOG[b]]:0; }

  function rsGenPoly(n){
    var p=[1];
    for(var i=0;i<n;i++){
      var q=[1,EXP[i]];
      var r=new Array(p.length+1).fill(0);
      for(var j=0;j<p.length;j++)
        for(var k=0;k<q.length;k++)
          r[j+k]^=gfMul(p[j],q[k]);
      p=r;
    }
    return p;
  }

  function rsEncode(data, n){
    var gen=rsGenPoly(n);
    var rem=data.slice();
    for(var i=0;i<n;i++) rem.push(0);
    for(var i=0;i<data.length;i++){
      var c=rem[i];
      if(c) for(var j=0;j<gen.length;j++) rem[i+j]^=gfMul(gen[j],c);
    }
    return rem.slice(data.length);
  }

  // ── Encode bytes ──
  var bytes=[];
  var enc=new TextEncoder().encode(text);
  enc.forEach(function(b){ bytes.push(b); });

  // Version selection: v1=17 sq, max ~17 bytes; v2=21, ~32; v3=25, ~53
  // EC level M
  var versions=[
    {v:1,sz:21,dataBytes:13,ecBytes:10,blocks:1},
    {v:2,sz:25,dataBytes:22,ecBytes:16,blocks:1},
    {v:3,sz:29,dataBytes:34,ecBytes:26,blocks:2}
  ];
  var ver=versions[0];
  for(var i=0;i<versions.length;i++){
    if(bytes.length<=versions[i].dataBytes){ ver=versions[i]; break; }
  }

  // Build data codewords
  var bits='';
  function addBits(val,len){ for(var i=len-1;i>=0;i--) bits+=((val>>i)&1)?'1':'0'; }
  addBits(4,4); // byte mode
  addBits(bytes.length,8);
  bytes.forEach(function(b){ addBits(b,8); });
  bits+='0000';
  while(bits.length%8) bits+='0';
  var codewords=[];
  for(var i=0;i<bits.length;i+=8) codewords.push(parseInt(bits.slice(i,i+8),2));
  var pads=[0xEC,0x11]; var pi=0;
  while(codewords.length<ver.dataBytes) codewords.push(pads[pi++%2]);

  // EC codewords (single block for v1/v2, two for v3)
  var allData=[];
  var allEC=[];
  if(ver.blocks===1){
    allData=codewords.slice();
    allEC=rsEncode(codewords,ver.ecBytes);
  } else {
    var half=Math.floor(ver.dataBytes/2);
    var b1=codewords.slice(0,half), b2=codewords.slice(half);
    var ec1=rsEncode(b1,ver.ecBytes/2), ec2=rsEncode(b2,ver.ecBytes/2);
    for(var i=0;i<Math.max(b1.length,b2.length);i++){
      if(i<b1.length) allData.push(b1[i]);
      if(i<b2.length) allData.push(b2[i]);
    }
    for(var i=0;i<ec1.length;i++){ allData.push(ec1[i]); allData.push(ec2[i]); }
    allEC=[];
  }
  var finalBits='';
  allData.forEach(function(c){ addBits2(c,8); });
  allEC.forEach(function(c){ addBits2(c,8); });
  function addBits2(v,l){ for(var i=l-1;i>=0;i--) finalBits+=((v>>i)&1)?'1':'0'; }
  while(finalBits.length%8) finalBits+='0';

  // ── Build matrix ──
  var sz=ver.sz;
  var mat=[];
  for(var i=0;i<sz;i++){ mat.push([]); for(var j=0;j<sz;j++) mat[i].push(-1); }

  // Finder pattern
  function finder(r,c){
    for(var dr=0;dr<7;dr++) for(var dc=0;dc<7;dc++){
      var edge=dr===0||dr===6||dc===0||dc===6;
      var center=dr>=2&&dr<=4&&dc>=2&&dc<=4;
      mat[r+dr][c+dc]=(edge||center)?1:0;
    }
    // separator
    for(var i=-1;i<=7;i++){
      if(r+i>=0&&r+i<sz){ if(c-1>=0&&mat[r+i][c-1]===-1) mat[r+i][c-1]=0; if(c+7<sz&&mat[r+i][c+7]===-1) mat[r+i][c+7]=0; }
      if(c+i>=0&&c+i<sz){ if(r-1>=0&&mat[r-1][c+i]===-1) mat[r-1][c+i]=0; if(r+7<sz&&mat[r+7][c+i]===-1) mat[r+7][c+i]=0; }
    }
  }
  finder(0,0); finder(0,sz-7); finder(sz-7,0);

  // Timing
  for(var i=8;i<sz-8;i++){
    if(mat[6][i]===-1) mat[6][i]=i%2===0?1:0;
    if(mat[i][6]===-1) mat[i][6]=i%2===0?1:0;
  }

  // Dark module
  mat[4*ver.v+9][8]=1;

  // Format info (EC level M, mask 0 → pattern 0b101010000010010 = 0x5412 masked with 0x5412)
  var fmt=0x5412; // precomputed for M/mask0 with mask 101010000010010
  var fmtBits='';
  for(var i=14;i>=0;i--) fmtBits+=((fmt>>i)&1)?'1':'0';
  var fpos=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  fpos.forEach(function(p,i){ if(mat[p[0]][p[1]]===-1) mat[p[0]][p[1]]=parseInt(fmtBits[i]); });
  // second copy
  for(var i=0;i<7;i++) if(mat[sz-1-i][8]===-1) mat[sz-1-i][8]=parseInt(fmtBits[i]);
  for(var i=7;i<15;i++) if(mat[8][sz-15+i]===-1) mat[8][sz-15+i]=parseInt(fmtBits[i]);

  // Alignment pattern (v2+)
  if(ver.v>=2){
    var ac=sz-7;
    for(var dr=-2;dr<=2;dr++) for(var dc=-2;dc<=2;dc++){
      var edge=Math.abs(dr)===2||Math.abs(dc)===2;
      var center=dr===0&&dc===0;
      if(mat[ac+dr][ac+dc]===-1) mat[ac+dr][ac+dc]=(edge||center)?1:0;
    }
  }

  // Place data bits
  var bi=0;
  var col=sz-1; var goUp=true;
  while(col>0){
    if(col===6) col--;
    for(var rr=0;rr<sz;rr++){
      var r2=goUp?sz-1-rr:rr;
      for(var delta=0;delta<=1;delta++){
        var c2=col-delta;
        if(mat[r2][c2]===-1){
          var bit=bi<finalBits.length?parseInt(finalBits[bi]):0;
          bi++;
          // mask 0: (r+c)%2===0
          mat[r2][c2]=(r2+c2)%2===0?bit^1:bit;
        }
      }
    }
    col-=2; goUp=!goUp;
  }

  // ── Render SVG ──
  var quiet=4;
  var total=sz+quiet*2;
  var cell=Math.floor(px/total);
  var side=cell*total;
  var off=quiet*cell;

  var rects='';
  for(var r=0;r<sz;r++){
    for(var c=0;c<sz;c++){
      if(mat[r][c]===1){
        rects+='<rect x="'+(off+c*cell)+'" y="'+(off+r*cell)+'" width="'+cell+'" height="'+cell+'"/>';
      }
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+side+'" height="'+side+'" viewBox="0 0 '+side+' '+side+'" shape-rendering="crispEdges"><rect width="'+side+'" height="'+side+'" fill="white"/><g fill="black">'+rects+'</g></svg>';
};
