var __awaiter=this&&this.__awaiter||function(e,t,n,o){function i(e){return e instanceof n?e:new n((function(t){t(e)}))}return new(n||(n=Promise))((function(n,r){function a(e){try{s(o.next(e))}catch(t){r(t)}}function c(e){try{s(o["throw"](e))}catch(t){r(t)}}function s(e){e.done?n(e.value):i(e.value).then(a,c)}s((o=o.apply(e,t||[])).next())}))};var __generator=this&&this.__generator||function(e,t){var n={label:0,sent:function(){if(r[0]&1)throw r[1];return r[1]},trys:[],ops:[]},o,i,r,a;return a={next:c(0),throw:c(1),return:c(2)},typeof Symbol==="function"&&(a[Symbol.iterator]=function(){return this}),a;function c(e){return function(t){return s([e,t])}}function s(a){if(o)throw new TypeError("Generator is already executing.");while(n)try{if(o=1,i&&(r=a[0]&2?i["return"]:a[0]?i["throw"]||((r=i["return"])&&r.call(i),0):i.next)&&!(r=r.call(i,a[1])).done)return r;if(i=0,r)a=[a[0]&2,r.value];switch(a[0]){case 0:case 1:r=a;break;case 4:n.label++;return{value:a[1],done:false};case 5:n.label++;i=a[1];a=[0];continue;case 7:a=n.ops.pop();n.trys.pop();continue;default:if(!(r=n.trys,r=r.length>0&&r[r.length-1])&&(a[0]===6||a[0]===2)){n=0;continue}if(a[0]===3&&(!r||a[1]>r[0]&&a[1]<r[3])){n.label=a[1];break}if(a[0]===6&&n.label<r[1]){n.label=r[1];r=a;break}if(r&&n.label<r[2]){n.label=r[2];n.ops.push(a);break}if(r[2])n.ops.pop();n.trys.pop();continue}a=t.call(e,n)}catch(c){a=[6,c];i=0}finally{o=r=0}if(a[0]&5)throw a[1];return{value:a[0]?a[1]:void 0,done:true}}};System.register(["./p-62bf01ac.system.js"],(function(e){"use strict";var t,n,o,i;return{setters:[function(e){t=e.r;n=e.c;o=e.h;i=e.g}],execute:function(){var r=":host{z-index:1000;position:fixed;top:0;left:0;width:100%;height:100%;display:-ms-flexbox;display:flex;contain:strict;--inset-width:600px;--inset-height:600px}.wrapper{-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;background-color:rgba(0, 0, 0, 0.15)}.content{-webkit-box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);width:var(--inset-width);height:var(--inset-height);max-height:100%}@media only screen and (max-width: 600px){.content{width:100%;height:100%}}";var a=e("pwa_camera_modal_instance",function(){function e(e){var o=this;t(this,e);this.onPhoto=n(this,"onPhoto",7);this.noDeviceError=n(this,"noDeviceError",7);this.facingMode="user";this.noDevicesText="No camera found";this.noDevicesButtonText="Choose image";this.handlePhoto=function(e){return __awaiter(o,void 0,void 0,(function(){return __generator(this,(function(t){this.onPhoto.emit(e);return[2]}))}))};this.handleNoDeviceError=function(e){return __awaiter(o,void 0,void 0,(function(){return __generator(this,(function(t){this.noDeviceError.emit(e);return[2]}))}))}}e.prototype.handleBackdropClick=function(e){if(e.target!==this.el){this.onPhoto.emit(null)}};e.prototype.handleComponentClick=function(e){e.stopPropagation()};e.prototype.handleBackdropKeyUp=function(e){if(e.key==="Escape"){this.onPhoto.emit(null)}};e.prototype.render=function(){var e=this;return o("div",{class:"wrapper",onClick:function(t){return e.handleBackdropClick(t)}},o("div",{class:"content"},o("pwa-camera",{onClick:function(t){return e.handleComponentClick(t)},facingMode:this.facingMode,handlePhoto:this.handlePhoto,handleNoDeviceError:this.handleNoDeviceError,noDevicesButtonText:this.noDevicesButtonText,noDevicesText:this.noDevicesText})))};Object.defineProperty(e.prototype,"el",{get:function(){return i(this)},enumerable:false,configurable:true});return e}());a.style=r}}}));