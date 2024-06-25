
# Typescript snippets

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

```typescript
import { NextPage } from 'next'

interface Props {}

const FileName: NextPage<Props> = ({}) => {
  return <div></div>
}

export default FileName
```

## `npssp` - nextPageServerSideProps

```typescript
import { NextPage, GetServerSideProps } from 'next'

interface Props {}

const FileName: NextPage<Props> = ({}) => {
  return <div></div>
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {}
  }
}

export default FileName
```

## `npsp` - nextPageStaticProps

```typescript
import { NextPage, GetStaticProps } from 'next'

interface Props {}

const FileName: NextPage<Props> = ({}) => {
  return <div></div>
}

export const getStaticProps: GetStaticProps = async (ctx) => {
  return {
    props: {},
  }
}

export default FileName
```

## `npspth` - nextPageStaticPaths

```typescript
import { NextPage, GetStaticPaths } from 'next'

interface Props {}

const FileName: NextPage<Props> = ({}) => {
  return <div></div>
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: false,
  }
}

export default FileName
```

## `nssp` - nextServerSideProps

```typescript
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {}
  }
}
```

## `nsp` - nextStaticProps

```typescript
export const getStaticProps: GetStaticProps = async (ctx) => {
  return {
    props: {},
  }
}
```

## `nspth` - nextStaticPaths

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: false,
  }
}
```

## `nip` - nextInitialProps

```typescript
FileName.getInitialProps = async (ctx) => {
  return {
    
  }
}
```

## `nimg` - nextImage

```typescript
<Image src="" alt="" />
```

## `napp` - nextApp

```typescript
import type { AppProps } from 'next/app'

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
```

## `ndoc` - nextDocument

```typescript
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
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

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

interface Data {}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  
}
```

## `nmid` - nextMiddleware

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  
}

export const config = {
  matcher: '/about/:path*',
}
```
