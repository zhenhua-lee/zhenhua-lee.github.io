---
title: "React组件单元测试"
category: framework
tags: ["react", "test"]
excerpt: >
  React官网推荐使用jest + React.addons.TestUtils进行单元测试。jest是单元测试的框架，React.addons.TestUtils是针对React相关的方法，二者结合在一起可以方面地进行React的单元测试。
---

## React组件单元测试

React官网推荐使用jest + React.addons.TestUtils进行单元测试。jest是单元测试的框架，React.addons.TestUtils是针对React相关的方法，二者结合在一起可以方面地进行React的单元测试。

###jest介绍

* jasmine：在jasmine框架基础上进行的二次开发，跟jasmine一样是**BDD**风格的测试框架

* auto mock

a. mock的原因

对于无法控制、操作为危险、耗时的、依赖于难于控制的行为，进行mock是非常必要的，例如异步获取数据，有时需要测试网络错误(http statusCode: 404)，网络正常情况下就难于直接测试，此时mock就显示出来了。

b. mock的实现

{% highlight js %}
jest.mock('XHR');
require('XHR'); // returns a mocked version of XHR

jest.dontMock('XHR');
require('XHR'); // returns the real XHR module
{% endhighlight %}

c. jasmine里面的mock需要显示指定，而jest里面的mock是默认进行的，例如：

{% highlight js %}
// obj.js
module.exports = {
  fn: function () {
    console.log('hello');
  },
  base: 23,
  array: [12,34,5]
}

// obj-test.js
describe('..', function () {
  it('...', function () {
    var obj = require('../obj.js');
    console.dir(obj);
  })
});

######
$: npm test
// 输出结果为：
/*
{ fn: {
    [Function]
    _isMockFunction: true,
    mock: { calls: [], instances: [] },
    mockClear: [Function],
    mockReturnValueOnce: [Function],
    mockReturnValue: [Function],
    mockImpl: [Function],
    mockImplementation: [Function],
    mockReturnThis: [Function],
    _getMockImplementation: [Function]
  },
  base: 23,
  array: []
}
*/
{% endhighlight %}

从上述代码可以看出，jest默认是对数据进行mock的。如果不需要对其进行mock，那么就可以使用：

{% highlight js %}
jest.donMock(path);
{% endhighlight %}

### 使用步骤

* step1：搭建符合React的环境

1.1 添加新的依赖、jsx预处理、unmock module

    // package.json
    {
      ...
      "script": {
        "test": "jest"
      },
      "devDependencies": {
        "react-tools": "^0.13.3",
        "jest-cli": "^0.4.13"
      },
      "jest": {
        "scriptPreprocessor": "./preprocessor.js",
        "unmockedModulePathPatterns": ["./node_modules/react"]
      }
    }

1.2 jsx预处理

    // preprocessor.js
    var ReactTools = require('react-tools');
    module.exports = {
      process: function(src) {
        return ReactTools.transform(src);
      }
    };

* step2：创建 \__tests__ 目录，然后添加测试用例，例如paginator-test.jsx

* step3：执行测试

{% highlight js %}
$: npm test
{% endhighlight %}

###使用心得

使用jest对React进行单元测试，该如何下手呢？可以从以下几个方面入手：

* 测试组件静态特征，以@mtfe/react-paginator为例

{% highlight js %}
it('paginator initialize', function () {
  var React = require('react/addons');
  var TestUtils = React.addons.TestUtils;
  var Paginator = require('../lib/Paginator.jsx');

  var pageNow = 1, pageCount = 100;
  var paginator = TestUtils.renderIntoDocument(
    <Paginator
      pageNow={pageNow}
      pageCount={pageCount}
      pageChange={pageChange}
      />);

  var liList = TestUtils.scryRenderedDOMComponentsWithTag(paginator, 'li');

  expect(+liList[1].getDOMNode().textContent).toEqual(pageNow)  // test1
  expect(+liList[liList.length - 2].getDOMNode().textContent).toEqual(pageCount) // test2
});
{% endhighlight %}

上述测试中，test1、test2分别用于测试，组件渲染后，渲染的结果是否符合预期，也就是页面是否在页面1、页码100

* 组件存在交互，且交互完全在组件内完成，不依赖于外部的props：测试交互后，改变的内容是否符合预期

* 组件存在交互，且交互依赖于外部：mock函数，检测函数的参数是否符合预期。仍然以@mtfe/react-paginator为例：

{% highlight js %}
it('click page number', function () {
  var React = require('react/addons');
  var TestUtils = React.addons.TestUtils;
  var Paginator = require('../lib/Paginator.jsx');

  var pageNow = 1, pageCount = 100;
  var paginator = TestUtils.renderIntoDocument(
   	<Paginator
      pageNow={pageNow}
      pageCount={pageCount}
      pageChange={pageChange}
      />);

  var liList = TestUtils.scryRenderedDOMComponentsWithTag(paginator, 'li');
  TestUtils.Simulate.click(liList[4]);  // click number 3
  expect(pageChange.mock.calls[0][0]).toEqual(3); // test 3
})
{% endhighlight %}

如上所述，通过测试mockFunction执行时的参数是否符合预期，可以得出该组件与外部交互是否正确。


