
# Javascript snippets

- `np` - nextPage
- `npssp` - nextPageServerSideProps
- `npsp` - nextPageStaticProps
- `npspth` - nextPageStaticPaths
- `nssp` - nextServerSideProps
- `nsp` - nextStaticProps
- `nspth` - nextStaticPaths
- `nip` - nextInitialProps
- `nimg` - nextImage
- `napp` - nextApp
- `ndoc` - nextDocument
- `napi` - nextApi
- `nmid` - nextMiddleware

## `np` - nextPage

```javascript
const FileName = ({}) => {
  return <div></div>
}

export default FileName
```

## `npssp` - nextPageServerSideProps

```javascript
const FileName = ({}) => {
  return <div></div>
}

export const getServerSideProps = async (ctx) => {
  return {
    props: {}
  }
}

export default FileName
```

## `npsp` - nextPageStaticProps

```javascript
const FileName = ({}) => {
  return <div></div>
}

export const getStaticProps = async (ctx) => {
  return {
    props: {},
  }
}

export default FileName
```

## `npspth` - nextPageStaticPaths

```javascript
const FileName = ({}) => {
  return <div></div>
}

export const getStaticPaths = async () => {
  return {
    paths: [],
    fallback: false,
  }
}

export default FileName
```

## `nssp` - nextServerSideProps

```javascript
export const getServerSideProps = async (ctx) => {
  return {
    props: {}
  }
}
```

## `nsp` - nextStaticProps

```javascript
export const getStaticProps = async (ctx) => {
  return {
    props: {},
  }
}
```

## `nspth` - nextStaticPaths

```javascript
export const getStaticPaths = async () => {
  return {
    paths: [],
    fallback: false,
  }
}
```

## `nip` - nextInitialProps

```javascript
FileName.getInitialProps = async (ctx) => {
  return {
    
  }
}
```

## `nimg` - nextImage

```javascript
<Image src="" alt="" />
```

## `napp` - nextApp

```javascript
export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

## `ndoc` - nextDocument

```javascript
import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument
```

## `napi` - nextApi

```javascript
export default async function handler(req, res) {
  
}
```

## `nmid` - nextMiddleware

```javascript
import { NextResponse } from 'next/server'
export async function middleware(request) {
  
}

export const config = {
  matcher: '/about/:path*',
}
```
