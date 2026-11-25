/* Minimal QR encoder: byte mode, EC level M, versions 1-3 (up to 42 chars). Exposes window.RioQR.svg(text,size) / matrix(text) */
(function(){
  var V={1:{n:26,d:16,e:10},2:{n:44,d:28,e:16},3:{n:70,d:44,e:26}};
  var EXP=[],LOG=[];(function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}for(i=255;i<512;i++)EXP[i]=EXP[i-255];})();
  function mul(a,b){return a&&b?EXP[LOG[a]+LOG[b]]:0;}
  function rs(data,n){var g=[1];for(var i=0;i<n;i++){var ng=new Array(g.length+1).fill(0);for(var j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=mul(g[j],EXP[i]);}g=ng;}
    var r=new Array(n).fill(0);data.forEach(function(b){var f=b^r[0];r.shift();r.push(0);for(var k=0;k<n;k++)r[k]^=mul(g[k+1],f);});return r;}
  function utf8(s){return Array.prototype.slice.call(unescape(encodeURIComponent(s))).map(function(c){return c.charCodeAt(0);});}
  function build(text){
    var bytes=utf8(text),ver=0;for(var v=1;v<=3;v++){if(4+8+bytes.length*8<=V[v].d*8){ver=v;break;}}
    if(!ver)throw new Error('qr too long');var P=V[ver],bits=[];
    function put(val,len){for(var i=len-1;i>=0;i--)bits.push((val>>i)&1);}
    put(4,4);put(bytes.length,8);bytes.forEach(function(b){put(b,8);});
    var cap=P.d*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
    var cw=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=b<<1|bits[i+j];cw.push(b);}
    for(var pad=0xec;cw.length<P.d;pad^=0xec^0x11)cw.push(pad);
    cw=cw.concat(rs(cw,P.e));
    var N=17+4*ver,M=[],F=[];for(i=0;i<N;i++){M.push(new Array(N).fill(false));F.push(new Array(N).fill(false));}
    function set(x,y,d){M[y][x]=d;F[y][x]=true;}
    function finder(cx,cy){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var x=cx+dx,y=cy+dy;if(x<0||y<0||x>=N||y>=N)continue;var d=Math.max(Math.abs(dx),Math.abs(dy));set(x,y,d!=2&&d!=4);}}
    finder(3,3);finder(N-4,3);finder(3,N-4);
    for(i=8;i<N-8;i++){set(i,6,i%2==0);set(6,i,i%2==0);}
    if(ver>1){var c=N-7;for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)set(c+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!=1);}
    set(8,N-8,true);
    for(i=0;i<9;i++){F[8][i]=F[i][8]=true;}for(i=0;i<8;i++){F[8][N-1-i]=true;F[N-1-i][8]=true;}
    var dbits=[];cw.forEach(function(b){for(var k=7;k>=0;k--)dbits.push((b>>k)&1);});
    var bi=0,up=true;for(var x=N-1;x>0;x-=2){if(x==6)x--;for(var t=0;t<N;t++){var y=up?N-1-t:t;for(var k=0;k<2;k++){var xx=x-k;if(!F[y][xx]){M[y][xx]=bi<dbits.length?!!dbits[bi]:false;bi++;}}}up=!up;}
    // mask 0 ((x+y)%2==0), format bits for EC M (00) mask 0
    for(y=0;y<N;y++)for(x=0;x<N;x++)if(!F[y][x]&&(x+y)%2==0)M[y][x]=!M[y][x];
    var data=(0<<3)|0,rem=data;for(i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
    var fmt=((data<<10)|rem)^0x5412;
    function fb(i){return((fmt>>i)&1)==1;}
    for(i=0;i<=5;i++)M[i][8]=fb(i);M[7][8]=fb(6);M[8][8]=fb(7);M[8][7]=fb(8);for(i=9;i<15;i++)M[8][14-i]=fb(i);
    for(i=0;i<8;i++)M[8][N-1-i]=fb(i);for(i=8;i<15;i++)M[N-15+i][8]=fb(i);
    M[N-8][8]=true;
    return M;
  }
  function svg(text,size){var M=build(text),N=M.length,q=4,t=N+q*2,p='';
    for(var y=0;y<N;y++)for(var x=0;x<N;x++)if(M[y][x])p+='M'+(x+q)+' '+(y+q)+'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+t+' '+t+'" width="'+(size||180)+'" height="'+(size||180)+'" shape-rendering="crispEdges"><rect width="'+t+'" height="'+t+'" fill="#fff"/><path d="'+p+'" fill="#000"/></svg>';}
  window.RioQR={matrix:build,svg:svg};
})();
