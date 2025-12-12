import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Card } from '@udonarium/card';
import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatTabSettingComponent } from 'component/chat-tab-setting/chat-tab-setting.component';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

@Component({
  selector: 'chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.css']
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewInit {
  sendFrom: string = 'Guest';

  get gameType(): string { return !this.chatMessageService.gameType ? 'DiceBot' : this.chatMessageService.gameType; }
  set gameType(gameType: string) { this.chatMessageService.gameType = gameType; }

  private _chatTabidentifier: string = '';

  get chatTabidentifier(): string { return this._chatTabidentifier; }
  set chatTabidentifier(chatTabidentifier: string) {
    let hasChanged: boolean = this._chatTabidentifier !== chatTabidentifier;
    this._chatTabidentifier = chatTabidentifier;
    this.updatePanelTitle();
    if (hasChanged) {
      this.scrollToBottom(true);
    }
  }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }
  isAutoScroll: boolean = true;
  scrollToBottomTimer: NodeJS.Timeout = null;

  constructor(
    public chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService
  ) { }

  ngOnInit() {
    this.sendFrom = PeerCursor.myCursor.identifier;
    this._chatTabidentifier = 0 < this.chatMessageService.chatTabs.length ? this.chatMessageService.chatTabs[0].identifier : '';

    EventSystem.register(this)
      .on('MESSAGE_ADDED', event => {
        if (event.data.tabIdentifier !== this.chatTabidentifier) return;
        let message = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (message && message.isSendFromSelf) {
          this.isAutoScroll = true;
        } else {
          this.checkAutoScroll();
        }
        if (this.isAutoScroll && this.chatTab) this.chatTab.markForRead();
      });
    Promise.resolve().then(() => this.updatePanelTitle());
  }

  ngAfterViewInit() {
    queueMicrotask(() => this.scrollToBottom(true));
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  // @TODO やり方はもう少し考えた方がいいい
  scrollToBottom(isForce: boolean = false) {
    if (isForce) this.isAutoScroll = true;
    if (!this.isAutoScroll) return;
    let event = new CustomEvent('scrolltobottom', {});
    this.panelService.scrollablePanel.dispatchEvent(event);
    if (this.scrollToBottomTimer != null) return;
    this.scrollToBottomTimer = setTimeout(() => {
      if (this.chatTab) this.chatTab.markForRead();
      this.scrollToBottomTimer = null;
      this.isAutoScroll = false;
      if (this.panelService.scrollablePanel) {
        this.panelService.scrollablePanel.scrollTop = this.panelService.scrollablePanel.scrollHeight;
      }
    }, 0);
  }

  // @TODO
  checkAutoScroll() {
    if (!this.panelService.scrollablePanel) return;
    let top = this.panelService.scrollablePanel.scrollHeight - this.panelService.scrollablePanel.clientHeight;
    if (top - 150 <= this.panelService.scrollablePanel.scrollTop) {
      this.isAutoScroll = true;
    } else {
      this.isAutoScroll = false;
    }
  }

  updatePanelTitle() {
    if (this.chatTab) {
      this.panelService.title = 'チャットウィンドウ - ' + this.chatTab.name;
    } else {
      this.panelService.title = 'チャットウィンドウ';
    }
  }

  onSelectedTab(identifier: string) {
    this.updatePanelTitle();
  }

  showTabSetting() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 250, top: coordinate.y - 175, width: 500, height: 350 };
    let component = this.panelService.open<ChatTabSettingComponent>(ChatTabSettingComponent, option);
    component.selectedTab = this.chatTab;
  }

  sendChat(value: { text: string, gameType: string, sendFrom: string, sendTo: string }) {
    if (this.chatTab) {
      this.chatMessageService.sendMessage(this.chatTab, value.text, value.gameType, value.sendFrom, value.sendTo);
    }
  }

  trackByChatTab(index: number, chatTab: ChatTab) {
    return chatTab.identifier;
  }

  //ライゴナリウム
  // 選択中のタブのログをダウンロード
  downloadCurrentTabLog(): void {
    const tabList = ChatTabList.instance as any;

    const tab: any =
      tabList.selectedChatTab
      ?? tabList.currentChatTab
      ?? (tabList.chatTabs && tabList.chatTabs.find((t: any) => t.selected || t.isSelected))
      ?? (tabList.chatTabs && tabList.chatTabs[0]);

    if (!tab) {
      alert('選択中のチャットタブが見つかりません');
      return;
    }

    const messages: ChatMessage[] =
      tab.chatMessages
      ?? tab.messages
      ?? [];

    if (!messages.length) {
      alert('このタブにはログがありません');
      return;
    }

    const lines = messages.map(msg => {
      const time = this.formatTime(msg.timestamp);
      const player = msg.name || '不明プレイヤー';
      const text = this.getLogText(msg);   // ★ここでログ用テキストを取得
      return `[${time}] ${player}：${text}`;
    });

    const filename = (tab.name || 'chat-log') + '.txt';
    this.saveTextFile(lines.join('\n'), filename);
  }

  // ★DL用テキストを作る（■は全て開示）
  private getLogText(msg: ChatMessage): string {
    // 元のテキスト（改行はスペースに）
    let text = (msg.text || '').toString().replace(/\r?\n/g, ' ');

    const meta = (msg as any).dicebot as string | undefined;
    const prefix = 'RAIGO_PIECE:';

    // ライゴナリウムの駒ログ以外はそのまま
    if (!meta || !meta.startsWith(prefix)) {
      return text;
    }

    // dicebot に仕込んでおいたカードIDからカードを取得
    const cardId = meta.substring(prefix.length);
    const card = ObjectStore.instance.get<Card>(cardId);

    if (!card || !card.name) {
      return text;
    }

    const pieceName = card.name as string;

    // 既に本当の駒名が含まれていれば何もしない
    if (text.includes(pieceName)) {
      return text;
    }

    // 駒名が伏せられている（■）とみなして全て駒名に開示
    if (text.includes('■')) {
      return text.replace(/■/g, pieceName);
    }

    return text;
  }

  // [時刻] 用のフォーマット（例: 21:03:45）
  private formatTime(timestamp: number): string {
    const t = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    const d = new Date(t);

    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0'); // 月は0始まりなので +1
    const DD = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');

    // ← 後ろにスペース付き
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
  }

  // ブラウザからテキストファイルを保存する
  private saveTextFile(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

}
