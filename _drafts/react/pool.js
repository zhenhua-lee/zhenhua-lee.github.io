/*
 * react中对象池的实现思路
 */
function getPool (...args) {
  var ClassA = this;
  if (ClassA._instancePool.length) {
    var instance = ClassA._instancePool.pop();
    ClassA.apply(instance, args);
    return instance;
  } else {
    return new ClassA(...args);
  }
}
function release(instance) {
  var ClassA = this;
  if (ClassA._instancePool.length < ClassA.poolMaxSize) {
    ClassA._instancePool.push(instance);
  }
}

function addPoolingTo(ClassA, maxSize) {
  var newClass = ClassA;
  newClass._instancePool = [];
  newClass.getPool = getPool;
  newClass.poolMaxSize = maxSize || 10;
  newClass.release = release;
  return newClass;
}

function Hello(name) {
  this.name = name;
}
Hello.prototype = {
  constructor: Hello,
  sayName: function () {
    console.log('you say ::: ', this.name);
  },
  destructor: function () {
    this.name = null;
  }
}

addPoolingTo(Hello);
var h1 = Hello.getPool('mt');
h1.sayName();

Hello.release(h1);
var h2 = Hello.getPool('dp');
h1.sayName();
h2.sayName();
console.log('h1 is equal h2: ', h1 === h2);
