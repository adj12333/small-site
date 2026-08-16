/**
 * MailSystem - 邮件通知系统
 * 简约科技风设计
 */
class MailSystem {
    constructor() {
        this.mails = [];
        this.unreadCount = 0;
        this.maxMails = 50;
        this._idCounter = 0;

        // 邮件类型配置 - 只保留 official 类型
        this.typeConfig = {
            official: { label: '官方', color: '#3b82f6', icon: '◉' }
        };

        // 监听回调
        this.onNewMail = null;
        this.onMailRead = null;
        this.onMailDelete = null;
        this.onAttachmentClaimed = null;
    }

    /**
     * 解析 gift 指令
     * @param {string} content - 邮件内容
     * @returns {number|null} 匹配到的数字或 null
     */
    parseGiftCommand(content) {
        const match = content.match(/\/\/gift\s+(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * 添加邮件
     * @param {Object} mail - 邮件对象
     * @param {string} mail.type - 邮件类型: 必须是 'official'
     * @param {string} mail.title - 邮件标题
     * @param {string} mail.content - 邮件内容
     * @param {Object} mail.data - 附加数据
     * @returns {string|null} 邮件ID，如果类型不是 official 则返回 null
     */
    addMail(mail) {
        // 只接受 official 类型的邮件
        if (mail.type !== 'official') {
            return null;
        }

        const id = mail.id || `mail_${++this._idCounter}_${Date.now()}`;
        const config = this.typeConfig.official;

        // 解析 gift 指令
        const giftAmount = this.parseGiftCommand(mail.content || '');
        const attachment = mail.attachment || (giftAmount !== null ? { type: 'proximaCoin', amount: giftAmount } : null);

        const entry = {
            id,
            type: 'official',
            title: mail.title || '官方消息',
            content: mail.content || '',
            data: mail.data || {},
            timestamp: mail.timestamp || Date.now(),
            read: mail.read || false,
            label: config.label,
            color: config.color,
            icon: config.icon,
            attachment,
            claimed: mail.claimed || false
        };

        // 添加到列表开头
        this.mails.unshift(entry);

        // 限制数量
        if (this.mails.length > this.maxMails) {
            const removed = this.mails.pop();
            if (!removed.read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
        }

        // 只有未读邮件才增加未读计数并触发新邮件通知
        if (!entry.read) {
            this.unreadCount++;
            // 触发回调
            if (this.onNewMail) {
                this.onNewMail(entry);
            }
        }

        return id;
    }

    /**
     * 标记邮件为已读
     * @param {string} id - 邮件ID
     */
    markAsRead(id) {
        const mail = this.mails.find(m => m.id === id);
        if (mail && !mail.read) {
            mail.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);

            if (this.onMailRead) {
                this.onMailRead(mail);
            }
        }
    }

    /**
     * 标记所有邮件为已读
     */
    markAllAsRead() {
        for (const mail of this.mails) {
            if (!mail.read) {
                mail.read = true;
            }
        }
        this.unreadCount = 0;
    }

    /**
     * 删除邮件
     * @param {string} id - 邮件ID
     */
    deleteMail(id) {
        const index = this.mails.findIndex(m => m.id === id);
        if (index !== -1) {
            const mail = this.mails[index];
            if (!mail.read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
            this.mails.splice(index, 1);

            if (this.onMailDelete) {
                this.onMailDelete(id);
            }
        }
    }

    /**
     * 清空所有邮件
     */
    clearAll() {
        this.mails = [];
        this.unreadCount = 0;
    }

    /**
     * 获取邮件列表
     * @param {boolean} unreadOnly - 只返回未读邮件
     * @returns {Array} 邮件列表
     */
    getMails(unreadOnly = false) {
        if (unreadOnly) {
            return this.mails.filter(m => !m.read);
        }
        return [...this.mails];
    }

    /**
     * 获取未读数量
     * @returns {number}
     */
    getUnreadCount() {
        return this.unreadCount;
    }

    /**
     * 获取邮件数量
     * @returns {number}
     */
    getMailCount() {
        return this.mails.length;
    }

    /**
     * 格式化时间显示
     * @param {number} timestamp - 时间戳
     * @returns {string}
     */
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            const date = new Date(timestamp);
            return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
    }

    /**
     * 创建官方邮件
     * @param {string} title - 标题
     * @param {string} content - 内容
     * @param {Object} data - 附加数据
     */
    addOfficialMail(title, content, data = {}) {
        return this.addMail({
            type: 'official',
            title,
            content,
            data
        });
    }

    /**
     * 检查邮件是否有附件
     * @param {string} mailId - 邮件ID
     * @returns {boolean}
     */
    hasAttachment(mailId) {
        const mail = this.mails.find(m => m.id === mailId);
        return mail ? mail.attachment !== null : false;
    }

    /**
     * 检查邮件附件是否已领取
     * @param {string} mailId - 邮件ID
     * @returns {boolean}
     */
    isClaimed(mailId) {
        const mail = this.mails.find(m => m.id === mailId);
        return mail ? mail.claimed : false;
    }

    /**
     * 领取邮件附件
     * @param {string} mailId - 邮件ID
     * @returns {Object} { success: boolean, amount: number }
     */
    claimAttachment(mailId) {
        const mail = this.mails.find(m => m.id === mailId);

        if (!mail || !mail.attachment || mail.claimed) {
            return { success: false, amount: 0 };
        }

        mail.claimed = true;
        if (this.onAttachmentClaimed) {
            this.onAttachmentClaimed(mailId, mail.attachment.amount);
        }
        return { success: true, amount: mail.attachment.amount };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MailSystem;
}
