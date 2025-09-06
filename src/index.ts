import { waitForElement, runWithAllElement } from "./lib/element.ts";

class Media {
    /**
     * 取得されたURL
     */
    public url: string;

    /**
     * メディアの拡張子
     */
    public extension: string;

    /**
     * @param url メディアURL
     */
    constructor(url: string) {
        this.url = url;

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
            return "";
        }
    }
}
class User {
    /**
     * ユーザーのスクリーンネーム
     */
    public screenName: string;

    /**
     * ユーザー名
     */
    public name: string;
}
class Tweet {
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

        // this.#element.querySelector('[data-testid="removeBookmark"]')?.click();
        // this.#element.querySelector('[data-testid="bookmark"]')?.click();

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

    public openSensitiveMedia(): void {
        this.#element.querySelector<HTMLElement>('[role="presentation"] div[role="button"]')?.click();
    }

    /**
     * ツイートのメディアを取得します。画像にのみ対応しています。
     * @returns {Promise<Media[]>}
     */
    async getMediaList() {
        if (this.#mediaList) return this.#mediaList;

        // NOTE: センシティブなメディアである旨の警告が表示されている場合は、表示ボタンを押す
        if (this.hasSensitiveMedia)
            this.openSensitiveMedia();

        // NOTE: サムネイルを取得
        const thumbnailContainers = Array.from(this.#element.querySelectorAll('a[href*="/photo/"]'));
        const thumbnails = await Promise.all(thumbnailContainers.map(async e => (await waitForElement<HTMLImageElement>("img", e)).item(0)));

        // NOTE: サムネイルのURLから、オリジナルのURLを取得
        this.#mediaList = thumbnails.map(t => new Media(t.src));

        return this.#mediaList;
    }
}

const styleTag = document.createElement("style");
styleTag.textContent = `
.twbd-button {
    background: none;
    border: none;
    cursor: pointer;

    display: flex;
    align-items: center;

    width: 1.25em;
    height: 1.25em;
    align-self: center;

    position: relative;
}
.twbd-button::before {
    content: "";
    display: block;
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    border-radius: 1000px;
    transition-duration: 0.2s;
}
/* NOTE: /photo/ は画像にしか通用しません。このaの下に[data-testid="tweetPhoto"]があるのでそれでの絞り込みも無理。 */
a[href*="/photo/"] .twbd-button {
    position: absolute;
    right: 12px;
    bottom: 12px;
    color: #ffffff;
}
a[href*="/photo/"] .twbd-button::before {
    backdrop-filter: blur(5px) contrast(0.5);
    border: 1px solid currentColor;
}
.twbd-button svg {
    width: 100%;
    height: auto;
    opacity: 0.6;
}
.twbd-button:hover::before {
    background-color: rgb(239, 243, 244, 0.1);
}
.twbd-button:active::before {
    background-color: rgb(239, 243, 244, 0.2);
}
</style>
`;
waitForElement("head").then(head => head[0].appendChild(styleTag));

const downloadButtonTemplate = new DOMParser().parseFromString(`
    <div class="twbd-button twbd-tweet-download-button">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-download" width="44" height="44" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
            <path d="M7 11l5 5l5 -5" />
            <path d="M12 4l0 12" />
        </svg>
    </div>
`, "text/html").body.children[0];

runWithAllElement<HTMLElement>('article[data-testid="tweet"]', element => {
    const tweet = new Tweet(element);

    tweet.openSensitiveMedia();

    // NOTE: ツイートのダウンロードボタン
//     const downloadButton = element.querySelector('[role="group"]')!.appendChild(downloadButtonTemplate.cloneNode(true)) as HTMLDivElement;
//     downloadButton.onclick = async evt => {
//         evt.preventDefault();

//         // TODO: 実装
//         // const author = await tweet.getAuthor();
//         // const mediaList = await tweet.getMediaList();
// //         console.log(`
// // ${author.name} @${author.screenName}

// // ${tweet.text}

// // ===

// // ${mediaList.map(m => m.getOriginalUrl()).join(", ")}

// // ===
// // ID: ${tweet.id}
// //         `);
//     };

    runWithAllElement<HTMLAnchorElement>('a[href*="/photo/"]', element => {
        const tweet = new Tweet(element.closest('[data-testid="tweet"]')!);

        const downloadButton = element.appendChild(downloadButtonTemplate.cloneNode(true)) as HTMLDivElement;
        downloadButton.onclick = async evt => {
            evt.preventDefault();

            const mediaList = await tweet.getMediaList();
            const mediaIndex = parseInt(/\/(\d+)$/.exec(element.href)?.[1] ?? "0") - 1;
            const media = mediaList[mediaIndex];

            const a = document.createElement("a");
            a.target = "_blank";
            a.href = URL.createObjectURL(await (await fetch(media.getOriginalUrl())).blob());
            a.download = `${(await tweet.getAuthor()).screenName}-${tweet.id}-${mediaIndex}.${media.extension}`;
            a.click();
        };
    }, element, true);
});