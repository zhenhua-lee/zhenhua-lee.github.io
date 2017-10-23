---
title: "egg"
category: egg
tags: ["egg", "node", "application"]
excerpt: >
  egg是阿里开源的、面向企业级的NODE WEB框架。框架本身在使用社区很多优秀的内容的基础上，做了进一步的封装，目的是快速、便捷、安全地开发企业应用。本文尝试从源码较多，解析其中的设计理念。
---

# egg

## egg的启动方式

```
// npm install egg-bin

./node_module/.bin/egg-bin dev
```

javascript的运行时单进程的，在浏览器上运行不存在太大的问题，但是在server端则存在如下问题:

- 服务的稳定性与健壮性: 一旦一个进程出现未捕获的异常，则整个应用就无法使用
- 无法充分利用多喝cpu: 现在的计算机都是多核，一个进程只能使用一个cpu，这样其他cpu资源就浪费了


egg提供了命令行模块(egg-bin)，专门用于node应用的启动。egg-bin使用egg-cluster用于创建多个node进程，并进行多进程的管理。


```
// egg-bin/lib/start-cluster.js
const options = JSON.parse(process.argv[2]);
require(options.framework).startCluster(options);


// egg-cluster/index.js
exports.startCluster = function(options, callback) {
  new Master(options).ready(callback);
};
// egg-cluster/lib/master.js
const cfork = require('cfork');
const appWorkerFile = path.join(__dirname, 'app_worker.js');
class Master extends EventEmitter {
	forkAppWorkers() {
		cfork({
      exec: appWorkerFile,
      args,
      silent: false,
      count: this.options.workers,
      // don't refork in local env
      refork: this.isProduction,
    });
	}
}	
// egg-cluster/lib/app_worker.js
const Application = require(options.framework).Application;
const app = new Application(options);
app.ready(startServer);
function startServer() {
	if (options.https) {
    server = require('https').createServer({
      key: fs.readFileSync(options.key),
      cert: fs.readFileSync(options.cert),
    }, app.callback());
  } else {
    server = require('http').createServer(app.callback());
  }
  server.listen(...args);
}

// cfork/index.js
const cluster = require('cluster');
function fork(options) {
	var count = options.count || os.cpus().length;
	cluster.setupMaster(opts);
	...
	for (var i = 0; i < count; i++) {
    newWorker = forkWorker();
    newWorker._clusterSettings = cluster.settings;
  }
}

function forkWorker(settings) {
  if (settings) {
    cluster.settings = settings;
    cluster.setupMaster();
  }
  return cluster.fork(attachedEnv);
}
```


egg启动后创建的进程有:

- master: 主进程，用于进程的管理
- agent: 主要处理公共资源的访问，如文件监听、帮worker处理一些公共事务(如一些事情是不需要每个worker都处理的，agent处理完后通知worker执行之后的操作)
- worker: 子进程，处理业务逻辑





