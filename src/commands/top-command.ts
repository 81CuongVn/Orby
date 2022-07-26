import { ApplicationCommandOptionType } from 'discord-api-types';
import { ApplicationCommandData, Collection, CommandInteraction, GuildMember } from 'discord.js';

import { EventData, OrbData } from '../models/internal-models';
import { MemberRepo } from '../repos';
import { Lang } from '../services';
import { ArrayUtils, MathUtils, MessageUtils, RegexUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class TopCommand implements Command {
    public static data: ApplicationCommandData = {
        name: 'top',
        description: 'Show the top orb savers.',
        options: [
            {
                name: 'type',
                description: 'Type of leaderboard to display.',
                required: false,
                type: ApplicationCommandOptionType.String.valueOf(),
                choices: [
                    {
                        name: 'overall',
                        value: 'OVERALL',
                    },
                    {
                        name: 'inbox',
                        value: 'INBOX',
                    },
                ],
            },
            {
                name: 'page',
                description: 'Page number to display.',
                required: false,
                type: ApplicationCommandOptionType.Integer.valueOf(),
            },
        ],
    };
    public name = TopCommand.data.name;
    public requireDev = false;
    public requireGuild = true;
    public requirePerms = [];

    constructor(private memberRepo: MemberRepo) {}

    public async execute(intr: CommandInteraction, data: EventData): Promise<void> {
        let topType = intr.options.getString('type') ?? 'OVERALL';

        let members: Collection<string, GuildMember>;
        try {
            members = await this.memberRepo.getActiveMembers(intr.guild);
        } catch (error) {
            return;
        }

        let displayNames = members
            .filter(member => !member.user.bot)
            .map(member => member.displayName);

        let orbDatas = displayNames
            .filter(RegexUtils.containsOrbs)
            .map(displayName => ({
                displayName,
                orbCount:
                    topType === 'INBOX'
                        ? RegexUtils.extractInboxOrbs(displayName)
                        : RegexUtils.extractTotalOrbs(displayName) || 0,
            }))
            .filter(orbData => orbData.orbCount > 0)
            .sort(this.compareOrbCounts);

        let lines = [];
        for (let [index, orbData] of orbDatas.entries()) {
            let rank = index + 1;
            lines.push(
                Lang.getRef('lists.topItem', data.lang(), {
                    MEMBER_RANK: rank.toLocaleString(),
                    ORB_COUNT: orbData.orbCount.toLocaleString(),
                    MEMBER_NAME: orbData.displayName,
                })
            );
        }

        let pageSize = Config.experience.topPageSize;
        let maxPage = Math.ceil(lines.length / pageSize) || 1;
        let page = MathUtils.clamp(intr.options.getInteger('page') || 1, 1, maxPage);

        let pageLines = ArrayUtils.paginate(lines, pageSize, page);
        let topList = pageLines.join('\n') || Lang.getRef('lists.topNone', data.lang());

        await MessageUtils.sendIntr(
            intr,
            Lang.getEmbed('displays.top', data.lang(), {
                ORB_TYPE:
                    topType === 'INBOX'
                        ? Lang.getRef('orbType.inbox', data.lang())
                        : Lang.getRef('orbType.overall', data.lang()),
                TOP_LIST: topList,
                CURRENT_PAGE: page.toLocaleString(),
                MAX_PAGE: maxPage.toLocaleString(),
            })
        );
    }

    private compareOrbCounts(a: OrbData, b: OrbData): number {
        if (a.orbCount > b.orbCount) {
            return -1;
        }
        if (a.orbCount < b.orbCount) {
            return 1;
        }
        return 0;
    }
}
