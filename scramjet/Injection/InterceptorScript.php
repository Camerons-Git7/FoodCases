<?php
/**
 * JavaScript Interceptor Script
 */

namespace Scramjet\Injection;

class InterceptorScript {
    private $proxyUrl;
    private $codecManager;

    public function __construct(string $proxyUrl, $codecManager) {
        $this->proxyUrl = $proxyUrl;
        $this->codecManager = $codecManager;
    }

    public function inject(string $html): string {
        $script = $this->generateScript();
        
        if (stripos($html, '</body>') !== false) {
            $html = str_ireplace('</body>', $script . '</body>', $html);
        } else {
            $html .= $script;
        }
        
        return $html;
    }

    private function generateScript(): string {
        $proxyUrl = $this->proxyUrl;
        $codecName = $this->codecManager->getDefaultCodec();
        
        return '<script>(function(){
            var p="' . $proxyUrl . '?q=";
            var codec="' . $codecName . '";
            
            var enc=function(u){
                if(codec==="base64"){
                    return btoa(u).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
                }else if(codec==="rot13"){
                    return u.replace(/[a-zA-Z]/g,function(c){
                        return String.fromCharCode((c<="Z"?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26);
                    });
                }
                return encodeURIComponent(u);
            };
            
            var dec=function(s){
                if(codec==="base64"){
                    return atob(s.replace(/-/g,"+").replace(/_/g,"/"));
                }else if(codec==="rot13"){
                    return s.replace(/[a-zA-Z]/g,function(c){
                        return String.fromCharCode((c<="Z"?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26);
                    });
                }
                return decodeURIComponent(s);
            };
            
            document.addEventListener("click",function(e){
                var a=e.target.closest("a");
                if(a&&a.href&&a.href.indexOf(p)!==0&&a.href.indexOf("javascript:")!==0&&a.href.indexOf("#")!==0&&a.href.match(/^https?:\/\//))
                    a.href=p+enc(a.href);
            },true);
            
            var of=window.fetch;
            window.fetch=function(u,o){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return of(u,o);
            };
            
            var oo=XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open=function(m,u,as,us,pw){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return oo.call(this,m,u,as,us,pw);
            };
            
            var ow=window.open;
            window.open=function(u,n,f){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return ow(u,n,f);
            };
            
            if(window.WebSocket){
                var owc=window.WebSocket;
                window.WebSocket=function(u,p){
                    if(typeof u==="string"&&u.match(/^wss?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                    return owc(u,p);
                };
            }
            
            if(window.navigator&&window.navigator.sendBeacon){
                var osb=window.navigator.sendBeacon;
                window.navigator.sendBeacon=function(u,d){
                    if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                    return osb(u,d);
                };
            }
        })();</script>';
    }
}
