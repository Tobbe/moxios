import { equal, notEqual, deepEqual } from 'assert'
import axios from 'axios'
import moxios from './index'

const USER_FRED = {
  id: 12345,
  firstName: 'Fred',
  lastName: 'Flintstone'
}

describe('moxios', function () {
  it('should install', function () {
    let defaultAdapter = axios.defaults.adapter
    moxios.install()
    notEqual(axios.defaults.adapter, defaultAdapter)
    moxios.uninstall()
  })

  it('should uninstall', function () {
    let defaultAdapter = axios.defaults.adapter
    moxios.install()
    moxios.uninstall()
    equal(axios.defaults.adapter, defaultAdapter)
  })

  describe('requests', function () {
    let onFulfilled
    let onRejected

    beforeEach(function () {
      moxios.install()
      onFulfilled = sinon.spy()
      onRejected = sinon.spy()
    })

    afterEach(function () {
      moxios.uninstall()
    })

    it('should intercept requests', function (done) {
      axios.get('/users/12345')

      moxios.wait(function () {
        let request = moxios.requests.mostRecent()
        equal(moxios.requests.count(), 1)
        done()
      })
    })

    it('should mock responses', function (done) {
      axios.get('/users/12345').then(onFulfilled)

      moxios.wait(function () {
        let request = moxios.requests.mostRecent()
        request.respondWith({
          status: 200,
          response: USER_FRED
        }).then(function () {
          let response = onFulfilled.getCall(0).args[0]
          equal(onFulfilled.called, true)
          equal(response.status, 200)
          deepEqual(response.data, USER_FRED)
          done()
        })
      })
    })

    it('should mock responses Error', function (done) {
      axios.get('/users/12346').then(onFulfilled, onRejected)

      moxios.wait(function () {
        let request = moxios.requests.mostRecent()
        request.respondWith({
          status: 404
        }).then(function () {
          equal(onFulfilled.called, false)
          equal(onRejected.called, true)
          done()
        })
      })
    })

    it('should mock one time', function (done) {
      moxios.uninstall()

      moxios.withMock(function () {
        axios.get('/users/12345').then(onFulfilled)

        moxios.wait(function () {
          let request = moxios.requests.mostRecent()
          request.respondWith({
            status: 200,
            response: USER_FRED
          }).then(function () {
            equal(onFulfilled.called, true)
            done()
          })
        })
      })
    })

    it('should timeout requests one time', function(done) {

      moxios.uninstall()

      moxios.withMock(function() {
        axios.get('/users/12345')

        moxios.wait(function() {
          let request = moxios.requests.mostRecent()
          request.respondWithTimeout().catch(function(err) {
            equal(err.code, 'ECONNABORTED')
            done()
          })
        })
      })
    })

    it('should stub requests', function (done) {
      moxios.stubRequest('get', '/users/12345', {
        status: 200,
        response: USER_FRED
      })

      axios.get('/users/12345').then(onFulfilled)

      moxios.wait(function () {
        let response = onFulfilled.getCall(0).args[0]
        deepEqual(response.data, USER_FRED)
        done()
      })
    })

    it('should stub requests with callback', function (done) {
      moxios.stubRequest('get', '/whoami', (request) => {
        return {
          status:   200,
          response: request.url
        }
      })

      axios.get('/whoami').then(onFulfilled)

      moxios.wait(function () {
        let response = onFulfilled.getCall(0).args[0]
        deepEqual(response.data, '/whoami')
        done()
      })
    })

    it('should stub timeout', function (done) {
      moxios.stubTimeout('/users/12345')

      axios.get('/users/12345').catch(onRejected)

      moxios.wait(function () {
        let err = onRejected.getCall(0).args[0]
        deepEqual(err.code, 'ECONNABORTED')
        done()
      })
    })

    it('should stub requests RegExp', function (done) {
      moxios.stubRequest('get', /\/users\/\d*/, {
        status: 200,
        response: USER_FRED
      })

      axios.get('/users/12345').then(onFulfilled)

      moxios.wait(function () {
        let response = onFulfilled.getCall(0).args[0]
        deepEqual(response.data, USER_FRED)
        done()
      })
    })

    it('should include a timestamp', function () {
      axios.get('/users/12345')

      return moxios.wait().then(function () {
        const request = moxios.requests.mostRecent()
        const timestamp = moxios.requests.mostRecent().timestamp;
        const diff = Date.now() - timestamp.getTime();
        equal(diff >= 0 && diff <= 1000, true);
      })
    })

    it('should include timestamp in debug output', function () {
      axios.get('/users/12345')
      axios.get('/users/12346')
      axios.delete('/users/12345')

      return moxios.wait(function () {
        const logs = [];
        let log = sinon.stub(console, 'log', str => logs.push(str));
        moxios.requests.debug();
        log.restore();

        equal(logs.filter(str => str).every(str => str.match(/^\d\d:\d\d\.\d{1,3}/)), true);
      })
    })

    describe('stubs', function () {
      it('should track multiple stub requests', function () {
        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        equal(moxios.stubs.count(), 2)
      })

      it('should find single stub by method', function () {
        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        let request = moxios.stubs.get('PUT', '/users/12345')

        notEqual(request, undefined)
      })

      it('should remove a single stub by method', function () {
        moxios.stubOnce('PUT', '/users/12346', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12345', {
          status: 200,
          response: USER_FRED
        })

        moxios.stubs.remove('PUT', '/users/12345')
        equal(moxios.stubs.count(), 3)
      })

      it('should not find stub with invalid method', function () {
        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        let request = moxios.stubs.get('GET', '/users/12345')

        equal(request, undefined)
      })

      it('should not find request on invalid method', function () {
        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        axios.put('/users/12346', USER_FRED)
        let request = moxios.requests.get('TEST')

        equal(request, undefined)
      })

      it('should find request after multiple stubs using same URI', function (done) {
        moxios.stubOnce('POST', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12345', {
          status: 200,
          response: USER_FRED
        })

        axios.put('/users/12345', USER_FRED).then(onFulfilled)

        moxios.wait(function () {
          let response = onFulfilled.getCall(0).args[0]
          equal(response.status, 204)
          let request = moxios.requests.get('PUT', '/users/12345')
          notEqual(request, undefined)
          done()
        })
      })

      it('Should stub and find multiple requests by method', function (done) {
        moxios.stubOnce('PUT', '/users/12345', {
          status: 204
        })

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        axios.put('/users/12345', USER_FRED).then(onFulfilled)
        axios.get('/users/12346', {}).then(onFulfilled)

        moxios.wait(function () {
          equal(onFulfilled.calledTwice, true)

          let response1 = onFulfilled.getCall(0).args[0]
          let response2 = onFulfilled.getCall(1).args[0]
          equal(response1.status, 204)
          equal(response2.status, 200)
          equal(response2.data.firstName, 'Fred')

          let request = moxios.requests.get('PUT', '/users/12345');
          notEqual(request, undefined)

          request = moxios.requests.get('GET', '/users/12346');
          notEqual(request, undefined)

          done()
        })
      })

      it('should stub requests with custom axios instance', function (done) {
        moxios.uninstall()

        const instance = axios.create({
          baseURL: 'https://api.example.com'
        })

        moxios.install(instance)

        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        instance.get('/users/12346').then(onFulfilled)

        moxios.wait(function () {
          let response = onFulfilled.getCall(0).args[0]
          equal(response.status, 200)
          equal(response.data, USER_FRED)
          done()
        })
      })

      it('should remove stubs when uninstalling', function () {
        moxios.stubRequest('get', '/users/12345', {
          status: 200,
          response: USER_FRED
        })

        equal(moxios.stubs.count(), 1);

        moxios.uninstall();

        equal(moxios.stubs.count(), 0);

        moxios.stubRequest('get', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        equal(moxios.stubs.count(), 1);
      })

      it('should replace existing stub when stubbing same url and method', function () {
        moxios.stubRequest('get', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        moxios.stubRequest('get', '/users/12346', {
          status: 500
        })

        let status;
        return axios.get('/users/12346')
          .then(response => status = response.status)
          .catch(error => status = error.response.status)
          .then(_ => equal(status, 500))
      })

      it('should not replace existing stubb for different url', function () {
        moxios.stubRequest('get', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        moxios.stubRequest('get', '/users/12345', {
          status: 500
        })

        let status;
        return axios.get('/users/12346')
          .then(response => status = response.status)
          .catch(error => status = error.response.status)
          .then(_ => equal(status, 200))
      })

      it('should not replace existing stubb for different method', function () {
        moxios.stubOnce('GET', '/users/12346', {
          status: 200,
          response: USER_FRED
        })

        moxios.stubOnce('POST', '/users/12346', {
          status: 500
        })

        let status;
        return axios.get('/users/12346')
          .then(response => status = response.status)
          .catch(error => status = error.response.status)
          .then(_ => equal(status, 200))
      })
    })

    describe('wait', function() {
      let timeSpy

      beforeEach(function() {
        timeSpy = sinon.spy(global, 'setTimeout');
      })

      afterEach(function() {
        global.setTimeout.restore();
      })

      it('should return promise', function () {
        return moxios.wait().then(() => {
          equal(timeSpy.calledWith(sinon.match.any, moxios.delay), true);
        })
      })

      it('should return promise that resolves after specified delay', function () {
        return moxios.wait(33).then(() => {
          equal(timeSpy.calledWith(sinon.match.any, 33), true);
        })
      })

      it('should call both callback and `then`-function', function () {
        let cbPromiseResolver = null;
        let thenPromiseResolver = null;

        const cbPromise = new Promise(resolve => cbPromiseResolver = resolve);
        const thenPromise = new Promise(resolve => thenPromiseResolver = resolve);

        moxios.wait(() => {
          cbPromiseResolver();
        }).then(() => {
          thenPromiseResolver();
        })

        return Promise.all([cbPromise, thenPromise]);
      })
    })
  })
})
