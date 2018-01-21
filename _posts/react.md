## react 的生命周期

### setState

```
// src/renderers/shared/stack/reconciler/ReactCompositeComponent.js
_processPendingState: function(props, context) {
	...
	var nextState = replace ? queue[0] : inst.state;
	var dontMutate = true;
	for (var i = replace ? 1 : 0; i < queue.length; i++) {
		var partial = queue[i];
		let partialState = typeof partial === 'function'
			? partial.call(inst, nextState, props, context)
        	: partial;
      if (partialState) {
        if (dontMutate) {
          dontMutate = false;
          nextState = Object.assign({}, nextState, partialState);
        } else {
          Object.assign(nextState, partialState);
        }
      }
    }

    return nextState;
}
```

## Error boundary

- 相当于给React Component增加了try catch机制
- 在React lifecycle里，增加一个方法`componentDidCatch`，出现错误的时候，会触发该方法，然后进行优雅的降级
- 只能处理子孙组件中出现的错误，无法处理自身的错误

## 