---
title: "service worker: 让web应用变得逆天的起来"
category: http
tags: ["http", "fetch"]
excerpt: >
  目前，service worker已经作为草案被提出，可以实现消息推动、地理围栏、离线应用等功能，相当于在浏览器端建立了一个代理服务，实现一些现在看来逆天的功能。

---

目前，service worker已经作为草案被提出，可以实现消息推动、地理围栏、离线应用等功能，相当于在浏览器端建立了一个代理服务，实现一些现在看来逆天的功能。



### 1. Service worker介绍

目前原生App跟HTML5相比具有如下优势:富离线体验、消息推送、定时默认更行等功能，这些优势决定了HTML5无法取代native。service worker(后面简称sw)就是在这样的背景下提出来的。

sw是一段运行在浏览器后端的脚本，独立于页面，是一个worker，也可以理解为一个网络代理服务器。因此sw是无法与DOM进行交互的，但是可以与js主线程进行通信。

### 2. 实现的功能

目前sw还是一个草案，各个浏览器支持程度还不是很高，除了chrome 40、firefox以外，其他浏览器均不支持该功能，但是sw提供的逆天功能还是非常值得期待:

- 后台数据的同步
- 从其他域获取资源请求
- 接受计算密集型数据的更新，多页面共享该数据
- 客户端编译与依赖管理
- 后端服务的hook机制
- 根据URL模式，自定义模板
- 性能优化
- 消息推送
- 定时默认更新
- 地理围栏

其中最期待的还是通过HTTP请求的拦截，进而实现离线应用，提升页面的性能体验。

### 3. 简单使用

**a.** 首先在页面注册一个service worker

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./index.js').then((reg) => {
        console.log('register a service worker: ', reg)
      }).catch((err) => {
        console.log('err: ', err);
      });
    }

**b.** 接着就可以在Service worker中尽情畅想

以页面的离线应用为出发点，说明sw如实做到离线应用的。

    const cacheUrl = [
      '/base.css',
      '/france.html'
    ];
    const cacheName = 'my-site-cache';

    // install阶段
    self.addEventListener('install', (event) => {
      console.log('sw event: install');
      event.waitUntil(
        caches.open(cacheName).then((cache) => {
          console.log('open cache');
          return cache.addAll(cacheUrl);
        })
      );
    });

    self.addEventListener('fetch', (event) => {
      event.respondWith(caches.match(event.request).then(res => {
        if (res) {
          console.log('match');
          return res;
        }
        return fetch(event.request);
      }));
    });



### 4. 生命周期

sw的说明周期主要包括三个阶段: install、active、working。下面这张图说明各个阶段完成的工作:

![](../img/service-work/sw-lifecycle.png)

### 5. 事件机制

sw本质上也是一个worker，所以sw开发也是建立在事件的基础上，通过事件机制完成相关业务逻辑的处理。

![](../img/service-work/sw-events.png)

其中sw里面的事件在原始事件对象[EVENT](https://developer.mozilla.org/en-US/docs/Web/API/Event),进行了拓展，例如fetch event里面拥有respondWith、waitUtil方法。

### 6. 补充介绍: Cache API


cache api就是对http的request/response进行缓存管理，是在service worker的规范中定义的，往往跟service worker一起操作使用，是实现web app离线应用的关键一环。但是cache api又不依赖于service worker，可以单独在window下使用，。

在window对象下，cache api的操作封装在`caches`对象下面，里面的操作分为两类: 对cache的操作、对cache里面http的操作。下面简单说明下cache storage的相关操作:

    // 下面是对cache的相关操作
    // open: 创建或打开一个cache
    caches.open('test').then(cache => {
      return cache.add('/base.css')
    }).then((val) => {
      console.log('create a cache and add "base.css" to it');
    });
    // 在cache storage查找缓存的资源
    caches.match('/base.css').then(res => {
      if (!res) return 'can not find this http in caches storage';
      return res.text()
    }).then((result) => {
      console.log(result)
    });
    // 得到所有的cache
    caches.keys().then(name => {
      console.log('names: ', name)
    });
    // 得到某个cache
    caches.delete('test').then(val => {
      console.log('delete success?: ', val)
    });

    // 对cache里面http进行操作
    caches.open('test').then(cache => {
      // 添加缓存资源
      return cache.add('/base.css')
    }).then((val) => {
      console.log('create a cache and add "base.css" to it');
    });

    caches.open('test').then(cache => {
      // 资源匹配
      return cache.match('/base.css')
    }).then(res => {
      return res.text()
    }).then(str => {
      console.log(str)
    });


### 参考

- [http://www.w3ctech.com/topic/866](http://www.w3ctech.com/topic/866)
- [https://www.w3.org/TR/service-workers/](https://www.w3.org/TR/service-workers/)
- [https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [https://davidwalsh.name/cache](https://davidwalsh.name/cache)
- [https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [https://developer.mozilla.org/en-US/docs/Web/API/Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache)