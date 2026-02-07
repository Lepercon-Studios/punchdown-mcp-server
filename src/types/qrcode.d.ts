declare module "qrcode" {
  interface QRCodeToStringOptions {
    type?: "terminal" | "svg" | "utf8";
    small?: boolean;
  }
  function toString(
    data: string,
    options?: QRCodeToStringOptions
  ): Promise<string>;
  export default { toString };
  export { toString };
}
