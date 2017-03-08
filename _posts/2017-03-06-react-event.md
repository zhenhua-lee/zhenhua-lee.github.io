---
title: "React源码解读系列 -- 事件机制"
category: react
tags: ["react", "synthetic", "event"]
excerpt: >
  本文首先分析React在DOM事件上的架构设计、相关优化、合成事件(Synethic event)对象，从源码层面上做到庖丁解牛的效果。同时，简单介绍下react事件可能会遇到的问题。
---

# React源码解读系列 -- 事件机制

本文首先分析React在DOM事件上的架构设计、相关优化、合成事件(Synethic event)对象，从源码层面上做到庖丁解牛的效果。同时，简单介绍下react事件可能会遇到的问题。

## 1. 总体设计

react在事件处理上具有如下优点:

- 几乎所有的事件代理(delegate)到`document`，达到性能优化的目的
- 对于每种类型的事件，拥有统一的分发函数`dispatchEvent`
- 事件对象(event)是合成对象(SyntheticEvent)，不是原生的

![](../img/react/react-event.jpg)

react内部事件系统实现可以分为两个阶段: 事件注册、事件触发。

## 2. 事件注册

[ReactDOMComponent](https://github.com/facebook/react/blob/master/src/renderers/dom/stack/client/ReactDOMComponent.js)在进行组件加载(mountComponent)、更新(updateComponent)的时候，需要对`props`进行处理(_updateDOMProperties):

```
ReactDOMComponent.Mixin = {
  _updateDOMProperties: function (lastProps, nextProps, transaction) {
    ...
    for (propKey in nextProps) {
      // 判断是否为事件属性
      if (registrationNameModules.hasOwnProperty(propKey)) {
        enqueuePutListener(this, propKey, nextProp, transaction);
      }
    }
  }
}
function enqueuePutListener(inst, registrationName, listener, transaction) {
  ...
  var doc = isDocumentFragment ? containerInfo._node : containerInfo._ownerDocument;
  listenTo(registrationName, doc);
  transaction.getReactMountReady().enqueue(putListener, {
    inst: inst,
    registrationName: registrationName,
    listener: listener
  });
  function putListener() {
    var listenerToPut = this;
    EventPluginHub.putListener(listenerToPut.inst, listenerToPut.registrationName, listenerToPut.listener);
  }
}
```

代码解析:

- 在props渲染的时候，如何属性是事件属性，则会用`enqueuePutListener`进行事件注册
- 上述`transaction`是ReactUpdates.ReactReconcileTransaction的实例化对象
- enqueuePutListener进行两件事情: 在`document`上注册相关的事件；对事件进行存储

### 2.1 document上事件注册

document的事件注册入口位于`ReactBrowserEventEmitter`:

```
// ReactBrowserEventEmitter.js
listenTo: function (registrationName, contentDocumentHandle) {
  ...
  if (...) {
    ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(...);
  } else if (...) {
    ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(...);
  }
  ...
}

// ReactEventListener.js
var ReactEventListener = {
  ...
  trapBubbledEvent: function (topLevelType, handlerBaseName, element) {
    ...
    var handler = ReactEventListener.dispatchEvent.bind(null, topLevelType);
    return EventListener.listen(element, handlerBaseName, handler);
  },
  trapCapturedEvent: function (topLevelType, handlerBaseName, element) {
    var handler = ReactEventListener.dispatchEvent.bind(null, topLevelType);
    return EventListener.capture(element, handlerBaseName, handler);
  }
  dispatchEvent: function (topLevelType, nativeEvent) {
    ...
    ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    ...
  }
}
function handleTopLevelImpl(bookKeeping) {
  ...
  ReactEventListener._handleTopLevel(bookKeeping.topLevelType, targetInst, bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
  ...
}
```

代码解析:
- 事件的注册、触发，具体是在`ReactEventListener`中实现的
- 事件的注册有两个方法: 支持冒泡(trapBubbledEvent)、trapCapturedEvent
- document不管注册的是什么事件，具有统一的回调函数`handleTopLevelImpl`
- document的回调函数中不包含任何的事物处理，只起到事件分发的作用

### 2.2 回调函数存储

函数的存储，在`ReactReconcileTransaction`事务的close阶段执行:

```
transaction.getReactMountReady().enqueue(putListener, {
  inst: inst,
  registrationName: registrationName,
  listener: listener
});
function putListener() {
  var listenerToPut = this;
  EventPluginHub.putListener(listenerToPut.inst, listenerToPut.registrationName, listenerToPut.listener);
}
```
事件的存储由`EventPluginHub`来进行管理，来看看其中的具体实现:

```
//
var listenerBank = {};
var getDictionaryKey = function (inst) {
  return '.' + inst._rootNodeID;
}
var EventPluginHub = {
  putListener: function (inst, registrationName, listener) {
    ...
    var key = getDictionaryKey(inst);
    var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[key] = listener;
    ...
  }
}
```
react中的所有事件的回调函数均存储在`listenerBank`对象里面，根据事件类型、component对象的_rootNodeID为两个key，来存储对应的回调函数。

## 3. 事件的执行

事件注册完之后，就可以依据事件委托进行事件的执行。由事件注册可以知道，几乎所有的事件均委托到document上，而document上事件的回调函数只有一个: ReactEventListener.dispatchEvent，然后进行相关的分发:

```
var ReactEventListener = {
  dispatchEvent: function (topLevelType, nativeEvent) {
    ...
    ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    ...
  }
}
function handleTopLevelImpl(bookKeeping) {
  var nativeEventTarget = getEventTarget(bookKeeping.nativeEvent);
  var targetInst = ReactDOMComponentTree.getClosestInstanceFromNode(nativeEventTarget);

  // 初始化时用ReactEventEmitterMixin注入进来的
  ReactEventListener._handleTopLevel(..., nativeEventTarget, targetInst);
}
// ReactEventEmitterMixin.js
var ReactEventEmitterMixin = {
  handleTopLevel: function (...) {
    var events = EventPluginHub.extractEvents(...);
    runEventQueueInBatch(events);
  }
}
function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue(false);
}
```

代码解析:
- handleTopLevelImpl: 根据原生的事件对象，找到事件触发的dom元素以及该dom对应的compoennt对象
- ReactEventEmitterMixin: 一方面生成合成的事件对象，另一方面批量执行定义的回调函数
- runEventQueueInBatch: 进行批量更新

### 3.1 合成事件的生成过程

react中的事件对象不是原生的事件对象，而是经过处理后的对象，下面从源码层面解析是如何生成的:

```
// EventPluginHub.js
var EventPluginHub = {
  extractEvents: function (...) {
    var events;
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0; i < plugins.length; i++) {
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
        if (extractedEvents) {
          events = accumulateInto(events, extractedEvents);
        }
      }
    }
    return events;
  }
}
```

EventPluginHub不仅存储事件的回调函数，而且还管理其中不同的plugins，这些plugins是在系统启动过程中注入(injection)过来的:

```
// react-dom模块的入口文件ReactDOM.js:
var ReactDefaultInjection = require('./ReactDefaultInjection');
ReactDefaultInjection.inject();
...
// ReactDefaultInjection.js
module.exports = {
  inject: inject
};
function inject() {
  ...
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,
    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
    ChangeEventPlugin: ChangeEventPlugin,
    SelectEventPlugin: SelectEventPlugin,
    BeforeInputEventPlugin: BeforeInputEventPlugin
  });
  ...
}
```

从上面代码可以看到，默认情况下，react注入了五种事件plugin，针对不同的事件，得到不同的合成事件，以最常见的`SimpleEventPlugin`为例进行分析:

```
var SimpleEventPlugin = {
  extractEvents: function (topLevelType, ...) {
    var EventConstructor;
    switch (topLevelType) {
      EventConstructor = one of [ SyntheticEvent, SyntheticKeyboardEvent, SyntheticFocusEvent, SyntheticMouseEvent, SyntheticDragEvent, SyntheticTouchEvent, SyntheticAnimationEvent, SyntheticTransitionEvent, SyntheticUIEvent, SyntheticWheelEvent, SyntheticClipboardEvent];
    }
    var event = EventConstructor.getPooled(dispatchConfig, targetInst, nativeEvent, nativeEventTarget);
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }
}
```
代码解析:

- 针对不同的事件类型，会生成不同的合成事件
- EventPropagators.accumulateTwoPhaseDispatches: 用于从EventPluginHub中获取回调函数，后面小节会具体分析获取过程

以其中的最基本的`SyntheticEvent`为例进行分析:

```
function SyntheticEvent(dispatchConfig, targetInst, nativeEvent, nativeEventTarget) {
  ...
  this.dispatchConfig = dispatchConfig;
  this._targetInst = targetInst;
  this.nativeEvent = nativeEvent;

  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    var normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      if (propName === 'target') {
        this.target = nativeEventTarget;
      } else {
        this[propName] = nativeEvent[propName];
      }
    }
  }
  ...
}
_assign(SyntheticEvent.prototype, {
  preventDefault: function () { ... },
  stopPropagation: function () { ... },
  ...
});
var EventInterface = {
  type: null,
  target: null,
  // currentTarget is set when dispatching; no use in copying it here
  currentTarget: emptyFunction.thatReturnsNull,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function (event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null
};
SyntheticEvent.Interface = EventInterface;

// 实现继承关系
SyntheticEvent.augmentClass = function (Class, Interface) {
  ...
}
```

### 3.2 获取具体的回调函数

上述合成事件对象在生成的过程中，会从`EventPluginHub`处获取相关的回调函数，具体实现如下:

```
// EventPropagators.js
function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginUtils.traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event);
  }
}
function accumulateDirectionalDispatches(inst, phase, event) {
  var listener = listenerAtPhase(inst, event, phase);
  if (listener) {
    event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
  }
}
var getListener = EventPluginHub.getListener;
function listenerAtPhase(inst, event, propagationPhase) {
  var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(inst, registrationName);
}
// EventPluginHub.js
getListener: function (inst, registrationName) {
  var bankForRegistrationName = listenerBank[registrationName];
  var key = getDictionaryKey(inst);
  return bankForRegistrationName && bankForRegistrationName[key];
},
```

### 3.3 批量执行事件的具体回调函数

react会进行批量处理具体的回调函数，回调函数的执行为了两步，第一步是将所有的合成事件放到事件队列里面，第二步是逐个执行:

```
var eventQueue = null;
var EventPluginHub = {
  enqueueEvents: function (events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  },
  processEventQueue: function (simulated) {
    var processingEventQueue = eventQueue;
    ...
    forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseSimulated);
    ...
  },
}
var executeDispatchesAndReleaseSimulated = function (e) {
  return executeDispatchesAndRelease(e, true);
};
var executeDispatchesAndRelease = function (event, simulated) {
  if (event) {
    EventPluginUtils.executeDispatchesInOrder(event, simulated);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};
// EventPluginUtils.js
function executeDispatchesInOrder(event, simulated) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchInstances = event._dispatchInstances;
  ...
  executeDispatch(event, simulated, dispatchListeners, dispatchInstances);
  ...
  event._dispatchListeners = null;
  event._dispatchInstances = null;
}
```

## 4. 可能存在的问题

### 4.1 合成事件与原生事件混用

在开发过程中，有时候需要使用到原生事件，例如存在如下的业务场景: 点击input框展示日历，点击文档其他部分，日历消失，代码如下:

```
// js部分
var React = require('react');
var ReactDOM = require('react-dom');
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showCalender: false
    };
  }
  componentDidMount() {
    document.addEventListener('click', () => {
      this.setState({showCalender: false});
      console.log('it is document')
    }, false);
  }
  render() {
    return (<div>
      <input
        type="text"
        onClick={(e) => {
          this.setState({showCalender: true});
          console.log('it is button')
          e.stopPropagation();
        }}
      />
      <Calendar isShow={this.state.showCalender}></Calendar>
    </div>);
  }
}
```
上述代码: 在点击input的时候，state状态变成true，展示日历，同时阻止冒泡，但是document上的click事件仍然触发了？到底是什么原因造成的呢？

原因解读: 因为react的事件基本都是委托到document上的，并没有真正绑定到input元素上，所以在react中执行stopPropagation并没有什么用处，document上的事件依然会触发。

解决办法:

#### 4.1.1 input的onClick事件也使用原生事件

```
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showCalender: false
    };
  }
  componentDidMount() {
    document.addEventListener('click', () => {
      this.setState({showCalender: false});
      console.log('it is document')
    }, false);
    this.refs.myBtn.addEventListener('click', (e) => {
      this.setState({showCalender: true});
      e.stopPropagation();
    }, false);
  }
  render() {
    return (<div>
      <input
        type="text"
        ref="myBtn"
      />
      <Calendar isShow={this.state.showCalender}></Calendar>
    </div>);
  }
}
```

#### 4.1.2 在document中进行判断，排除目标元素

```
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showCalender: false
    };
  }
  componentDidMount() {
    document.addEventListener('click', (e) => {
      var tar = document.getElementById('myInput');
      if (tar.contains(e.target)) return;
      console.log('document!!!');
      this.setState({showCalender: false});
    }, false);
  }
  render() {
    return (<div>
      <input
        id="myInput"
        type="text"
        onClick={(e) => {
          this.setState({showCalender: true});
          console.log('it is button')
          // e.stopPropagation();
        }}
      />
      <Calendar isShow={this.state.showCalender}></Calendar>
    </div>);
  }
}
```

### 4.2 不是所有事件都会委托到document上

前面提到『几乎所有的事件代理(delegate)到`document`』，『几乎』说明存在例外的情况。例如对于`audio`、`video`标签，存在一些媒体事件(例如onplay、onpause)，而这些事件是document不具有的，那么只能在这些标签上进行事件绑定，绑定一个入口分发函数(dispatchEvent)。

```
// ReactDOMComponent.js
function trapBubbledEventsLocal() {
  switch (inst._tag) {
    case 'iframe':
    case 'object':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent('topLoad', 'load', node)];
      break;
    case 'video':
    case 'audio':

      inst._wrapperState.listeners = [];
      // Create listener for each media event
      for (var event in mediaEvents) {
        if (mediaEvents.hasOwnProperty(event)) {
          inst._wrapperState.listeners.push(ReactBrowserEventEmitter.trapBubbledEvent(event, mediaEvents[event], node));
        }
      }
      break;
    case 'source':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent('topError', 'error', node)];
      break;
    case 'img':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent('topError', 'error', node), ReactBrowserEventEmitter.trapBubbledEvent('topLoad', 'load', node)];
      break;
    case 'form':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent('topReset', 'reset', node), ReactBrowserEventEmitter.trapBubbledEvent('topSubmit', 'submit', node)];
      break;
    case 'input':
    case 'select':
    case 'textarea':
      inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent('topInvalid', 'invalid', node)];
      break;
  }
}
var mediaEvents = {
  topAbort: 'abort',
  topCanPlay: 'canplay',
  topCanPlayThrough: 'canplaythrough',
  topDurationChange: 'durationchange',
  topEmptied: 'emptied',
  topEncrypted: 'encrypted',
  topEnded: 'ended',
  topError: 'error',
  topLoadedData: 'loadeddata',
  topLoadedMetadata: 'loadedmetadata',
  topLoadStart: 'loadstart',
  topPause: 'pause',
  topPlay: 'play',
  topPlaying: 'playing',
  topProgress: 'progress',
  topRateChange: 'ratechange',
  topSeeked: 'seeked',
  topSeeking: 'seeking',
  topStalled: 'stalled',
  topSuspend: 'suspend',
  topTimeUpdate: 'timeupdate',
  topVolumeChange: 'volumechange',
  topWaiting: 'waiting'
};
```

## 5. 小结

React在设计事件机制的时候，利用冒泡原理充分提高事件绑定的效率，使用`EventPluginHub`对回调函数、事件插件进行管理，然后通过一个统一的入口函数实现事件的分发，整个设计思考跟jQuery的事件实现上存在相似的地方，非常值得学习借鉴。


