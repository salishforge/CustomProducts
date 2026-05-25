/*
 * AuthKit OAuth callback. Default handler — sets the sealed-cookie session
 * and redirects back to the originating path.
 */
export { handleAuth as GET } from "@workos-inc/authkit-nextjs";
