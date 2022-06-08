/*
 * @Author: Evan Zuo v_wangxiangbo01@baidu.com
 * @Date: 2022-06-08 12:01:31
 * @LastEditors: Evan Zuo v_wangxiangbo01@baidu.com
 * @LastEditTime: 2022-06-08 12:24:03
 * @FilePath: /my-first-taro-app/src/common/http.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import Taro, { getStorageSync, navigateTo, removeStorageSync, setStorageSync } from '@tarojs/taro'
import { create, PreQuest } from '@prequest/miniprogram'
import errorRetryMiddleware from '@prequest/error-retry'
import timeout from '@prequest/timeout'
import Lock from '@prequest/lock'

declare module '@prequest/types' {
    interface PQRequest {
        skipTokenCheck?: boolean
    }
}

// 全局配置
PreQuest.defaults.baseURL = 'http://localhost:5000'
PreQuest.defaults.header = {}

// 全局中间件
PreQuest.use(async (ctx, next) => {
    await next()
    console.log(ctx.response.data)
})

export const prequest = create(Taro.request, { method: 'GET' })

// 中间件
// 错误重试中间件
const errorRetry = errorRetryMiddleware({
    retryCount: 3,
    retryControl(opt, e) {
        // 这个错误是下面 parse 中间件抛出的
        if (e.message === '401') {
            // 如果是 401 请求未认证报错，则清除 token, 这样会重新请求 token 接口，拿到最新的 token 值
            lock.clear()
        }

        // 只有 GET 请求才走错误重试
        return opt.method === 'GET'
    }
})

// 无痕刷新 token 中间件
export const lock = new Lock({
    getValue() {
        return getStorageSync('token')
    },
    setValue(token) {
        setStorageSync('token', token)
    },
    clearValue() {
        removeStorageSync('token')
    }
})
const wrapper = Lock.createLockWrapper(lock)

const refreshToken = async (ctx, next) => {
    if (ctx.request.skipTokenCheck) return next()
    const token = await wrapper(() => prequest('/token', { skipTokenCheck: true }).then(res => res.data))
    ctx.request.header['Authorization'] = token
    await next()
}

// 解析响应
const parse = async (ctx, next) => {
    await next()
    // 用户服务器返回 401, 微信不会抛出异常、需要用户自己处理
    // 这里抛出异常，会被错误重试中间件捕获
    const { statusCode } = ctx.response
    if (![200, 301, 302].includes(statusCode)) {
        throw new Error('' + statusCode)
    }
}

// 实例中间件
// prequest
//     .use(errorRetry)
//     .use(refreshToken)
//     .use(timeout)
//     .use(parse)
