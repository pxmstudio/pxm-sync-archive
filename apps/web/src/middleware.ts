import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const publicRoutes = [
  '/sign-in',
  '/sign-up',
  '/sign-in/forgot-password',
  '/sign-in/sso-callback',
  '/sign-up/sso-callback',
]

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname

  // Allow public auth routes through without authentication
  if (publicRoutes.some((route) => pathname === route)) {
    return NextResponse.next()
  }

  // Get auth state
  const { userId } = await auth({ treatPendingAsSignedOut: false })

  // Check if this is an RSC prefetch request
  const isRSCRequest = request.headers.get('rsc') === '1' ||
                       request.headers.get('next-router-prefetch') === '1' ||
                       request.nextUrl.searchParams.has('_rsc')

  // If not authenticated, redirect to local sign-in
  if (!userId) {
    if (isRSCRequest) {
      return new NextResponse(null, { status: 401 })
    }
    const originalUrl = `${request.nextUrl.origin}/app${pathname}${request.nextUrl.search || ""}`
    const signInUrl = new URL("/app/sign-in", request.url)
    signInUrl.searchParams.set("redirect_url", originalUrl)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
