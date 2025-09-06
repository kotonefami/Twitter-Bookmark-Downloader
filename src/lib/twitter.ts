import { waitForElement } from "./element.ts";

export class Media {
    /**
     * 取得されたURL
     */
    public url: string;

    /**
     * 動画であるかどうか
     */
    public isVideo: boolean;

    /**
     * メディアの拡張子
     */
    public extension: string;

    /**
     * @param url メディアURL
     * @param isVideo 動画であるかどうか
     */
    constructor(url: string, isVideo: boolean) {
        this.url = url;
        this.isVideo = isVideo;

        this.extension = /(format=([a-z0-9]+)|\.([a-zA-Z0-9]{1,4})$)/.exec(this.url ?? "")?.[2] ?? "";
    }

    /**
     * オリジナル画質のURLを取得します。
     */
    getOriginalUrl(): string {
        if (this.url.startsWith("https://pbs.twimg.com/media/")) {
            return this.url.replace(/name=([0-9a-z]+)/, "name=4096x4096").replace(/format=([a-z0-9]+)/, "format=png");
        } else if (this.url.startsWith("https://pbs.twimg.com/profile_images/")) {
            return this.url.replace("_original", "");
        } else {
            return this.url;
        }
    }
}
export class User {
    /**
     * ユーザーのスクリーンネーム
     */
    public screenName: string;

    /**
     * ユーザー名
     */
    public name: string;
}
export class Tweet {
    /**
     * 正常に取得できるツイートオブジェクトであるかどうか
     */
    public isValid: boolean = false;

    /**
     * プロモーションツイートであるかどうか
     */
    public isPromotion: boolean = false;

    /**
     * ツイートが投稿された日時
     */
    public createdAt: Date | null;

    /**
     * ツイートID
     */
    public id: string;

    /**
     * ツイート本文
     */
    public text: string;

    #element: HTMLElement;
    #author: User;
    #mediaList: Media[];

    /**
     * @param element ツイート要素
     */
    constructor(element: HTMLElement) {
        this.#element = element;

        const tweetLink = element.querySelector<HTMLAnchorElement>('a[href*="/status/"]:not([href$="/analytics"])');
        if (!tweetLink) this.isPromotion = true;

        const tweetTimeString = (tweetLink?.querySelector("time") ?? element.querySelector("time"))?.dateTime;
        this.createdAt = tweetTimeString ? new Date(tweetTimeString) : null;

        this.id = /\/status\/(\d+)/.exec(tweetLink?.href ?? "")?.[1] ?? "";
        this.text = element.querySelector('[data-testid="tweetText"]')?.textContent ?? "";

        // TODO: これだと、(文字ありツイート) -- リツイート --> (文字なしツイート) を取得したときにRT元のツイートのテキストが参照されてしまう
        // TODO: リツイート対応（おそらく、 querySelectorAll('[data-testid="Tweet-User-Avatar"]').length でなんとかなる）

        this.isValid = true;
    }

    /**
     * ツイートの投稿者を取得します。
     * @returns {Promise<User>}
     */
    async getAuthor() {
        if (this.#author) return this.#author;

        this.#author = new User();
        const userIconLink = this.#element.querySelector<HTMLAnchorElement>('[data-testid="Tweet-User-Avatar"] a')!;
        (await waitForElement<HTMLImageElement>("img", userIconLink))[0].src
        const userLink = this.#element.querySelector('[data-testid="User-Name"] a')!;
        this.#author.screenName = /\/([a-zA-Z0-9_]{1,16})$/.exec(userIconLink.href)?.[1]!;
        this.#author.name = userLink.textContent!;

        return this.#author;
    }

    /**
     * センシティブメディアが含まれているかどうか
     */
    public get hasSensitiveMedia(): boolean {
        return !!this.#element.querySelector('a[href="/settings/content_you_see"]');
    }

    /**
     * 
     */
    public openSensitiveMedia(): void {
        this.#element.querySelector<HTMLElement>('[role="presentation"] div[role="button"]')?.click();
    }

    /**
     * ツイートのメディアを取得します。画像と一部の動画（GIF画像？）にのみ対応しています。
     * @returns {Promise<Media[]>}
     */
    async getMediaList() {
        if (this.#mediaList) return this.#mediaList;

        // NOTE: センシティブなメディアである旨の警告が表示されている場合は、表示ボタンを押す
        if (this.hasSensitiveMedia)
            this.openSensitiveMedia();

        // NOTE: サムネイルを取得
        const mediaContainers = Array.from(this.#element.querySelectorAll('a[href*="/photo/"], video'));
        const mediaList = (await Promise.all(mediaContainers.map(async e => {
            if (e instanceof HTMLVideoElement) {
                if (e.src === "") {
                    // TODO: <video><source> は source.src に blob が入るが、fetch では取得ができない
                    return null;

                    // TODO: 最高画質の動画を取得する
                    // const source = e.querySelector("source");

                    // if (!source) return null;
                    // return await new Promise<string>(async (resolve, reject) => {
                    //     const reader = new FileReader();
                    //     reader.onloadend = () => resolve(reader.result as string);
                    //     reader.onerror = reject;
                    //     reader.readAsDataURL(await (await fetch(source.src)).blob());
                    // });
                } else {
                    return e.src;
                }
            } else {
                return (await waitForElement<HTMLImageElement>("img", e)).item(0).src;
            }
        }))).filter((a): a is string => !!a);

        console.log(mediaList);

        // NOTE: サムネイルのURLから、オリジナルのURLを取得
        this.#mediaList = mediaList.map(src => new Media(src, false));

        return this.#mediaList;
    }


    /**
     * ツイートをブックマークに追加します。
     */
    public addBookmark() {
        this.#element.querySelector<HTMLElement>('[data-testid="bookmark"]')?.click();
    }

    /**
     * ツイートをブックマークから削除します。
     */
    public removeBookmark() {
        this.#element.querySelector<HTMLElement>('[data-testid="removeBookmark"]')?.click();
    }
}
