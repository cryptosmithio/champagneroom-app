if(!self.define){let e,i={};const s=(s,a)=>(s=new URL(s+".js",a).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(a,c)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(i[n])return;let l={};const o=e=>s(e,n),b={module:{uri:n},exports:l,require:o};i[n]=Promise.all(a.map((e=>b[e]||o(e)))).then((e=>(c(...e),l)))}}define(["./workbox-d249b2c8"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"assets/audio-disabled.10587e7d.svg",revision:"cf24d230e059b3ddea75dc245abe7708"},{url:"assets/audio-enabled.a9ba6acc.svg",revision:"49ac8deefd486c5d533c8b507d2ac4dd"},{url:"assets/black.png",revision:"ff4f3c59280eae9edf60778bd04c7f63"},{url:"assets/Framework7Icons-Regular.a42aa071.woff2",revision:"4a39aba9fb8a2f831fa437780e1a058a"},{url:"assets/Framework7Icons-Regular.eba1e821.woff",revision:"d03b787b6492fa2b0141c43fb7e56689"},{url:"assets/index.4d34e7aa.css",revision:"ec30abf0cb47f5aebdf30e39aab699de"},{url:"assets/index.ea7d7573.js",revision:"c2ce1d9532d3e85bac32087ae88c342a"},{url:"assets/logo.png",revision:"ab94d64807b4355999842f8ac1ffd902"},{url:"assets/material-icons.8265f647.woff2",revision:"53436aca8627a49f4deaaa44dc9e3c05"},{url:"assets/material-icons.fd84f88b.woff",revision:"3e1afe59fa075c9e04c436606b77f640"},{url:"assets/profile/default.png",revision:"3e703bf153dd729cc1f9ebbc80d3f2ef"},{url:"assets/settings.9fb76c5b.svg",revision:"6cbeebd479a382a6be3a613a698b6470"},{url:"assets/speaker-icon.8d4af9c3.svg",revision:"ebf9427cca767d2ed55a9d1fd354e83c"},{url:"assets/video-disabled.1fd90e0a.svg",revision:"92f49b92d77aecda68030f547a540431"},{url:"assets/video-enabled.3ae41769.svg",revision:"150e2a1d4ab68728eeb46e10bc7af2c9"},{url:"assets/web.678f8dfe.js",revision:"c1334cd23546b8a887abb55d8243d06c"},{url:"assets/web.964213ba.js",revision:"16fe54a99bf78a06e0d3dd0c706fbc2e"},{url:"icons/128x128.png",revision:"ecc4b9016b8150e1b329cd9730a1b45a"},{url:"icons/144x144.png",revision:"9ad9f7bd076448221fc23372ec7962d4"},{url:"icons/152x152.png",revision:"b768848262eeca7ed9ee213732e4a808"},{url:"icons/192x192.png",revision:"7fd3d007ac7be019064bb8e5aeac2ead"},{url:"icons/256x256.png",revision:"61d91c2a3b3704a3749791ff7069defd"},{url:"icons/512x512.png",revision:"32c43d9573a09899f88c099467e71964"},{url:"icons/apple-touch-icon.png",revision:"c2ca859fc69cd9ada9fdf7b110603312"},{url:"icons/favicon.png",revision:"ecc4b9016b8150e1b329cd9730a1b45a"},{url:"index.html",revision:"8ded0fa239a46a79e2d63c8e9504bad8"},{url:"lib/ionicpwaelements/cjs/css-shim-1b988199.js",revision:"cd1083e609cc9d9ca408364d5b516a81"},{url:"lib/ionicpwaelements/cjs/dom-760f300f.js",revision:"bc90d787960cc693c8dcc4732a566f82"},{url:"lib/ionicpwaelements/cjs/index-5d6851b1.js",revision:"a3f7f9e644dfc7815c21c16d3b21fe81"},{url:"lib/ionicpwaelements/cjs/index.cjs.js",revision:"1207512ab506f92d1258b295c8bf79f3"},{url:"lib/ionicpwaelements/cjs/ionicpwaelements.cjs.js",revision:"4199159e52cebf2a351eff1a33800f70"},{url:"lib/ionicpwaelements/cjs/loader.cjs.js",revision:"b8c71e367b9e5a1f4d52ccae03cf7b15"},{url:"lib/ionicpwaelements/cjs/patch-c258dbcd.js",revision:"ee91039cdc98923541c2f958c358301b"},{url:"lib/ionicpwaelements/cjs/pwa-action-sheet.cjs.entry.js",revision:"02bbca9f77e40709250317ccac948921"},{url:"lib/ionicpwaelements/cjs/pwa-camera-modal-instance.cjs.entry.js",revision:"21a8d2f5ab00640b71156460e0b1380c"},{url:"lib/ionicpwaelements/cjs/pwa-camera-modal.cjs.entry.js",revision:"d240f60151aa48800477a6c19b8734df"},{url:"lib/ionicpwaelements/cjs/pwa-camera.cjs.entry.js",revision:"28a7dd80b386e0785c419287954781d4"},{url:"lib/ionicpwaelements/cjs/pwa-toast.cjs.entry.js",revision:"e30a6fd9e84bd2d0d0de80526fab2b1b"},{url:"lib/ionicpwaelements/cjs/shadow-css-fd34e37c.js",revision:"f5039481963c1f6d37a9059104d8c533"},{url:"lib/ionicpwaelements/collection/components/action-sheet/action-sheet.css",revision:"0054cd958434762949989a2198582895"},{url:"lib/ionicpwaelements/collection/components/action-sheet/action-sheet.js",revision:"e203e0cd5b726fed5787c41157d5a3c3"},{url:"lib/ionicpwaelements/collection/components/camera-modal/camera-modal-instance.css",revision:"733e22e2a8f5e358cfd564be509aae34"},{url:"lib/ionicpwaelements/collection/components/camera-modal/camera-modal-instance.js",revision:"bbc55a40d0dee7012e57f6566a29dda0"},{url:"lib/ionicpwaelements/collection/components/camera-modal/camera-modal.css",revision:"5691a6653d5f76323a20d218a9c3c421"},{url:"lib/ionicpwaelements/collection/components/camera-modal/camera-modal.js",revision:"060e236b0aa4cfbbe919eec02f8747dc"},{url:"lib/ionicpwaelements/collection/components/camera/camera.css",revision:"e1f642b52443b5f60558839aeba1d0c9"},{url:"lib/ionicpwaelements/collection/components/camera/camera.js",revision:"504da68d5b69defdf6131bb075e4c39f"},{url:"lib/ionicpwaelements/collection/components/camera/icons/confirm.svg",revision:"6da8dfa1a282021f17a6311bbbe8f2d1"},{url:"lib/ionicpwaelements/collection/components/camera/icons/exit.svg",revision:"2c71296bef3912ef70371b6c91a9c70d"},{url:"lib/ionicpwaelements/collection/components/camera/icons/flash-auto.svg",revision:"9e07f17bafb609e80a6370469aa8b9bb"},{url:"lib/ionicpwaelements/collection/components/camera/icons/flash-off.svg",revision:"112baea845987d1f9f05362b57add3a4"},{url:"lib/ionicpwaelements/collection/components/camera/icons/flash-on.svg",revision:"34d6d8e774891afbef3b1caf54afed3c"},{url:"lib/ionicpwaelements/collection/components/camera/icons/retake.svg",revision:"6608cd9f2eab45204a313d94359050b1"},{url:"lib/ionicpwaelements/collection/components/camera/icons/reverse-camera.svg",revision:"26b8a79df441ad384b954261df97808c"},{url:"lib/ionicpwaelements/collection/components/camera/imagecapture.js",revision:"135addab9c4f16fa8c1eb2d78d4c6d00"},{url:"lib/ionicpwaelements/collection/components/toast/toast.css",revision:"e2c12dc6fbb0b2cc403edd2ed81c860c"},{url:"lib/ionicpwaelements/collection/components/toast/toast.js",revision:"211edbf40722f5d4bea87fd6a1663869"},{url:"lib/ionicpwaelements/collection/definitions.js",revision:"d41d8cd98f00b204e9800998ecf8427e"},{url:"lib/ionicpwaelements/collection/index.js",revision:"b40b548eb7a008942fd7ae010c24cd77"},{url:"lib/ionicpwaelements/esm-es5/css-shim-5ce2b5c4.js",revision:"340aaaca4fd8e7c94296b00088c87b87"},{url:"lib/ionicpwaelements/esm-es5/dom-91ed8d21.js",revision:"31d87f0c62faf738c30aea6c1e6fb33f"},{url:"lib/ionicpwaelements/esm-es5/index-8be597a0.js",revision:"d42f5227186e46f6d07af3b2c2dbf05f"},{url:"lib/ionicpwaelements/esm-es5/patch-c62dfddd.js",revision:"fca4268928b735ae92aedd2089cb459c"},{url:"lib/ionicpwaelements/esm-es5/pwa-action-sheet.entry.js",revision:"5c62bfa4d299e69e747893fd59aedaa1"},{url:"lib/ionicpwaelements/esm-es5/pwa-camera-modal-instance.entry.js",revision:"6fc5053dcaa34897eeb5a2d8b342a17e"},{url:"lib/ionicpwaelements/esm-es5/pwa-camera-modal.entry.js",revision:"53ebe198164e96d6bc5de7899d4269ba"},{url:"lib/ionicpwaelements/esm-es5/pwa-camera.entry.js",revision:"ee82a9d8bccd92823975571cafe5d7c3"},{url:"lib/ionicpwaelements/esm-es5/pwa-toast.entry.js",revision:"ca2e89d153df209da4e40e674846b829"},{url:"lib/ionicpwaelements/esm-es5/shadow-css-fb1c6168.js",revision:"f91d49fd61c4ab537db3576d8ee5fbda"},{url:"lib/ionicpwaelements/esm/css-shim-5ce2b5c4.js",revision:"a2f935e68cb5e35da9dcddfee2eeee08"},{url:"lib/ionicpwaelements/esm/dom-91ed8d21.js",revision:"bada96a028513520c1fa4f5a88697c49"},{url:"lib/ionicpwaelements/esm/index-8be597a0.js",revision:"f3e93f437ff43d4bdd480090a061ff1a"},{url:"lib/ionicpwaelements/esm/patch-c62dfddd.js",revision:"ff85f4228c471997f54e22e6cf0e64e8"},{url:"lib/ionicpwaelements/esm/polyfills/core-js.js",revision:"dc27e0f38ebdd9196d36d393a6c60f4a"},{url:"lib/ionicpwaelements/esm/polyfills/css-shim.js",revision:"7f26f9f9914ab1b8c71c6eeda0e5e02b"},{url:"lib/ionicpwaelements/esm/polyfills/dom.js",revision:"c59c209ccd8f829bb4bc0aaa99055edb"},{url:"lib/ionicpwaelements/esm/polyfills/es5-html-element.js",revision:"9cb6d45f69c87c978029d1aa0a05ac92"},{url:"lib/ionicpwaelements/esm/polyfills/index.js",revision:"5d28b4eb5c1b0be899b011ab79c6f328"},{url:"lib/ionicpwaelements/esm/polyfills/system.js",revision:"e44813fe9fa71bac4abfeb30b88b457d"},{url:"lib/ionicpwaelements/esm/pwa-action-sheet.entry.js",revision:"da7f2f9b2c0cd961acccc81bba396f12"},{url:"lib/ionicpwaelements/esm/pwa-camera-modal-instance.entry.js",revision:"334648764f230bd79423b6ce8287cb96"},{url:"lib/ionicpwaelements/esm/pwa-camera-modal.entry.js",revision:"4e73323e01a38bf8d30252f9ddde0860"},{url:"lib/ionicpwaelements/esm/pwa-camera.entry.js",revision:"55105e8d43eca169b6a8ff15bdb36eb1"},{url:"lib/ionicpwaelements/esm/pwa-toast.entry.js",revision:"e3af28c6cb304432352e18cccbab9b38"},{url:"lib/ionicpwaelements/esm/shadow-css-fb1c6168.js",revision:"d6f27000bb57e5fc3849263a0fc4060d"},{url:"lib/ionicpwaelements/index.js",revision:"66e04f2fb404ebfb2502d6647369ec3b"},{url:"lib/ionicpwaelements/ionicpwaelements.js",revision:"411385689876fbfe8902ad4908e662d1"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/confirm.svg",revision:"6da8dfa1a282021f17a6311bbbe8f2d1"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/exit.svg",revision:"2c71296bef3912ef70371b6c91a9c70d"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/flash-auto.svg",revision:"9e07f17bafb609e80a6370469aa8b9bb"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/flash-off.svg",revision:"112baea845987d1f9f05362b57add3a4"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/flash-on.svg",revision:"34d6d8e774891afbef3b1caf54afed3c"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/retake.svg",revision:"6608cd9f2eab45204a313d94359050b1"},{url:"lib/ionicpwaelements/ionicpwaelements/icons/reverse-camera.svg",revision:"26b8a79df441ad384b954261df97808c"},{url:"lib/ionicpwaelements/ionicpwaelements/index.esm.js",revision:"d41d8cd98f00b204e9800998ecf8427e"},{url:"lib/ionicpwaelements/ionicpwaelements/ionicpwaelements.esm.js",revision:"1fce31aefa96818a645bcfa21c9d6389"},{url:"lib/ionicpwaelements/ionicpwaelements/ionicpwaelements.js",revision:"4baa5cc98f99fd8382231788140a2b13"},{url:"lib/ionicpwaelements/ionicpwaelements/p-045b143f.js",revision:"52d1d40980dc1f42901f69c542f3bfad"},{url:"lib/ionicpwaelements/ionicpwaelements/p-0817b0ae.entry.js",revision:"f909fdb7fa384ff51bae00851c060da7"},{url:"lib/ionicpwaelements/ionicpwaelements/p-0ad0b6e8.js",revision:"40066690bc5022b6e9ddc14ef74a6a4a"},{url:"lib/ionicpwaelements/ionicpwaelements/p-2d753de4.system.entry.js",revision:"d14c00b6a6d642c6bb905b75db2e9705"},{url:"lib/ionicpwaelements/ionicpwaelements/p-2ea8fff4.entry.js",revision:"68b76afa9dcf6b10979dd37b351055fd"},{url:"lib/ionicpwaelements/ionicpwaelements/p-3d1015c2.js",revision:"bab781b5e49e3c7cd3fbe819e2ef282b"},{url:"lib/ionicpwaelements/ionicpwaelements/p-4223ccfb.entry.js",revision:"c5d813cf5f5c2c301ddb0af4dbb975cb"},{url:"lib/ionicpwaelements/ionicpwaelements/p-50811587.system.js",revision:"19ca38bb9b72bf1bfe6b9a08e82a4e05"},{url:"lib/ionicpwaelements/ionicpwaelements/p-50ea2036.system.js",revision:"ff010a762247065e8c9bf90ff6e9bced"},{url:"lib/ionicpwaelements/ionicpwaelements/p-5d0eee38.system.js",revision:"80629660e9f19d66dd9fe24bce2c6d0d"},{url:"lib/ionicpwaelements/ionicpwaelements/p-62bf01ac.system.js",revision:"88e5e539d16fdb96173816b15cf2acd6"},{url:"lib/ionicpwaelements/ionicpwaelements/p-653f9586.entry.js",revision:"bf12f6a69574c24a7d84b4d73677bca1"},{url:"lib/ionicpwaelements/ionicpwaelements/p-75076c56.system.js",revision:"d74536596c22ee21fba6a5a8b34718a2"},{url:"lib/ionicpwaelements/ionicpwaelements/p-78512a53.system.entry.js",revision:"4870f72e6978bded7fae09bf8df7512d"},{url:"lib/ionicpwaelements/ionicpwaelements/p-7faff4bb.js",revision:"ab6e84c960e33df5195d2fc19def95af"},{url:"lib/ionicpwaelements/ionicpwaelements/p-8e1247ca.system.entry.js",revision:"9d7e6a434a0e237d72ddae8f8ce05efc"},{url:"lib/ionicpwaelements/ionicpwaelements/p-918d051a.js",revision:"a87963aeda14ab6759f6f69e3969aac3"},{url:"lib/ionicpwaelements/ionicpwaelements/p-97a19bb7.system.entry.js",revision:"9a5b991f6e8a2c4fe3f78949627f1501"},{url:"lib/ionicpwaelements/ionicpwaelements/p-b6aafeca.system.entry.js",revision:"414b0f4580161544576410d80c1cf5d9"},{url:"lib/ionicpwaelements/ionicpwaelements/p-f692f5eb.system.js",revision:"e24fd29a6eaddea17aeb9481a1941cc7"},{url:"lib/ionicpwaelements/ionicpwaelements/p-f9a50fb2.entry.js",revision:"74e18ac8dbd6bc7fe9df0a751ece0055"},{url:"lib/ionicpwaelements/ionicpwaelements/p-fb53799e.system.js",revision:"275372c45c49e3af63afcb70359890f7"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]})}));
//# sourceMappingURL=service-worker.js.map
