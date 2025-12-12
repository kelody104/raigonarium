import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatMessage } from '@udonarium/chat-message';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ChatMessageService } from 'service/chat-message.service';
import { SpectatorService } from 'service/spectator.service';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Network } from '@udonarium/core/system';
import { Card } from '@udonarium/card';

@Component({
  selector: 'chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.css'],
  animations: [
    trigger('flyInOut', [
      transition('* => active', [
        animate('200ms ease-out', keyframes([
          style({ transform: 'translateX(100px)', opacity: '0', offset: 0 }),
          style({ transform: 'translateX(0)', opacity: '1', offset: 1.0 })
        ]))
      ]),
      transition('void => *', [
        animate('200ms ease-out', keyframes([
          style({ opacity: '0', offset: 0 }),
          style({ opacity: '1', offset: 1.0 })
        ]))
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.Default
})

export class ChatMessageComponent implements OnInit {
  @Input() chatMessage: ChatMessage;
  imageFile: ImageFile = ImageFile.Empty;
  animeState: string = 'inactive';

  constructor(
    private chatMessageService: ChatMessageService,
    private spectatorService: SpectatorService,   // ★追加
  ) { }

  ngOnInit() {
    // --- アイコンを決める ---

    let file: ImageFile | null = null;

    // 1) このメッセージを送ったユーザーの ID を取得
    //    ChatMessage.from / originFrom には sender の userId が入る
    const senderUserId: string = this.chatMessage.from || this.chatMessage.originFrom;

    // 2) その userId に対応する PeerCursor を探し、あればそのアイコンを使う
    if (senderUserId) {
      const cursor = PeerCursor.findByUserId(senderUserId);
      if (cursor && cursor.image) {
        file = cursor.image;
      }
    }

    // 3) 見つからなかった場合だけ、従来どおり chatMessage.image を使う
    if (!file) {
      file = this.chatMessage.image;
    }

    if (file) {
      this.imageFile = file;
    }

    // --- アニメーションは元のまま ---
    const time = this.chatMessageService.getTime();
    if (time - 10 * 1000 < this.chatMessage.timestamp) {
      this.animeState = 'active';
    }
  }

  // ★追加：画面表示用のテキスト（マスク処理込み）
  // 表示用テキスト（秘匿ログだけマスクする）
  get displayText(): string {
    const text = this.chatMessage.text ?? '';
    const meta = this.chatMessage.dicebot ?? '';

    const prefix = 'RAIGO_PIECE:';
    if (this.spectatorService.enabled) {
      return text;  // 常に本来の駒名で表示
    }
    if (!meta.startsWith(prefix)) {
      // ライゴ用の駒ログでなければそのまま
      return text;
    }

    // RAIGO_PIECE:<cardId>:<flag>
    const parts = meta.split(':');
    // parts[0] = 'RAIGO_PIECE'
    const cardId = parts[1];
    const flag = parts[2] ?? '0';

    const wasSecret = flag === '1';
    if (!wasSecret) {
      // ログ生成時点で秘匿でなかった → 常にオープン表示
      return text;
    }

    const card = ObjectStore.instance.get<Card>(cardId);
    if (!card) return text;

    const myUserId = Network.peer.userId;

    // オーナー自身 or オーナー情報なし → オープン表示
    if (!card.owner || card.owner === myUserId) {
      return text;
    }

    // ここから先：他人が見る場合だけマスク
    const pieceName = card.name;
    if (!pieceName) return text;

    // 正規表現用にエスケープ
    const esc = pieceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(esc, 'g');

    return text.replace(pattern, '■');
  }


  discloseMessage() {
    this.chatMessage.tag = this.chatMessage.tag.replace('secret', '');
  }
}
