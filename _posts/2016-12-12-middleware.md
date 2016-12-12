# 前端开发中的中间件

中间件(middleware)技术由来已久，在服务端是一个很常见的概念，大的公司有专门的中间件团队，通过middleware连接组件、系统、服务，减少应用层开发的复杂度。随着前端技术的发展，midddleware也在很多地方出现，例如redux、koa里面。本文基于个人有限的了解，简单分析下前端中间件的实现原理。

<div style="margin: 0 auto; width: 100%; text-align: center"><img src="../img/middleware/middleware.png" /></div>

## 基于回调函数的实现

假如存在如下三个middleware，希望依照顺序执行三个middleware:

```
function mid1(next) {
  return () => {
    console.log('first mid1.1')
    next()
    console.log('first mid1.2')
  }
}
function mid2(next) {
  return () => {
    console.log('first mid2.1')
    next()
    console.log('first mid2.2')
  }
}
function mid3(next) {
  return () => {
    console.log('first mid3.1')
    next()
    console.log('first mid3.2')
  }
}
var noop = () => {}
mid1(mid2(mid3(noop))()
```
上面的代码可以按照次序进行执行，但是会出现层层嵌套的问题，那如何让代码优雅起来的？下面是一种实现思路:

```
function noop() {}
function compose(arrFn) {
  var last = arrFn[arrFn.length - 1];
  var rest = arrFn.slice(0, -1);
  return function() {
    var next = next || noop;
    return rest.reduceRight(function(pre, item) {
      return item(pre);
    }, last(next))
  }
}

const fn = compose([mid1, mid2, mid3]);
fn()();
```
其实[redux里面的compose](https://github.com/reactjs/redux/blob/master/src/compose.js)就是这样的实现方式，通过高阶函数避免了函数的层层嵌套。

## 基于generator

业内流行的新一代node框架koa，使用generator进行流程控制，是另外一种middleware的实现机制，同时可以解决异步编程的回调嵌套问题。

```
var koa = require('./koa');
var app = koa();
app.use(function* (next) {
  console.log('access logger begin %s', this.request.url);
  yield next;
  console.log('access logger end');
});
app.use(function* (next){
  var begin = new Date();
  yield next;
  console.log('use time %d', new Date - begin);
})
app.use(function* () {
  this.body = yield new Promise(function (resolve) {
    setTimeout(() => {
      resolve('hello midddleware');
    }, 100)
  })
});
app.listen(3000);
```

那上面的逻辑是如何先的呢?

```
// 首先对middleware进行聚合

```


