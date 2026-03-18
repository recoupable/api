// Configure which paths the middleware matcher applies to.
// Currently used to specify Next.js runtime for API routes.
export const config = {
  matcher: ["/protected/:path*", "/api/:path*"],
  runtime: "nodejs",
};
