/**
* MIT License
* 
* Copyright (c) 2022 Neirn
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
 */

/**
 * Installation instructions:
 * 1. Copy PluginCommonBase (included with MZ) into your project's \js\plugins folder
 *      a. If you're using the Steam version of MZ, you can find this plugin in
 *         \steamapps\common\RPG Maker MZ\dlc\BasicResources\plugins\official
 * 2. Place this plugin into your project's \js\plugins folder
 * 3. Open the Plugin Manager and add and enable PluginCommonBase
 * 4. Add this plugin BELOW PluginCommonBase and enable it
 */

/*:
 * @author Neirn 
 * @url https://github.com/Neirn/RMMZ-Plugins
 * @target MZ
 * @base PluginCommonBase
 *
 * @plugindesc Reposition the actors in sideview battles.
 * v1.0.0
 *
 * @help
 * This is a simple plugin that allows the developer to reposition the
 * side view positions of the party members.
 * 
 * Usage Instructions:
 * The part of the plugin that holds the data for repositioning your 
 * party members is the positions array. By default, this array is
 * populated with data that will set the first four members of your
 * party in the "vanilla" positions as seen in any fresh project.
 * 
 * This is an array of data that tells the plugin where to place
 * each party member during a side view battle. The indeces of the
 * data in the array directly correspond to the indeces of the party
 * members. So, the first entry of the array (0) corresponds to the
 * position of the first party member. The second entry of the array
 * corresponds to the position of the second party member. And so on.
 * 
 * If your party has more than 4 members, then just add new slots to
 * the array; in theory, any number of party members will work as
 * long as each party member has a corresponding positions entry.
 * 
 * Now, let's discuss the structure of each entry in the array. Upon
 * adding or opening an entry, you will be greated with three options:
 * Parent Party Index, X Coordinate, and Y Coordinate.
 * 
 * The Parent Party Index refers to the index of the party member you
 * would like to set as the parent to this one. In general, the party
 * member's side view battle position is calculated as follows:
 * 
 * this Member's Battle Screen X Coord = (Parent's Battle Screen X + this Member's X Coordinate)
 * this Member's Battle Screen Y Coord = (Parent's Battle Screen Y + this Member's Y Coordinate)
 * 
 * If this position has NO parent, then the battle screen coordinates
 * are calculated relative to coordinates (0,0), which corresponds to
 * the top left of the UI area.
 * 
 * The other parameters relate to the escape parameters. They are
 * fairly self-explanatory. The topmost parameter, Modify Retreat,
 * determines whether to modify the escape animation at all. if you
 * are using another plugin that modifies the escape animation, then
 * it is recommended that you keep this disabled.
 * 
 * The X Movement and Y Movement parameters for the retreat determine
 * the direction that the party moves in upon a successful escape.
 * X corresponds to the horizontal movement and Y to vertical.
 * 
 * As the name imples, the Duration parameter determines how long it
 * takes for the party members to travel the X and Y distances
 * defined in the movement parameters.
 * 
 * @param positions
 * @text Party Battler Positions
 * @type struct<BattlerPosition>[]
 * @default ["{\"parentIndex\":\"-1\",\"x\":\"600\",\"y\":\"280\"}","{\"parentIndex\":\"0\",\"x\":\"32\",\"y\":\"48\"}","{\"parentIndex\":\"1\",\"x\":\"32\",\"y\":\"48\"}","{\"parentIndex\":\"2\",\"x\":\"32\",\"y\":\"48\"}"]
 * 
 * @param retreat
 * @text Modify Retreat
 * @type boolean
 * @desc Enabling this overwrites the retreat animation parameters with custom ones set here.
 * @default false
 * 
 * @param retreatX
 * @parent retreat
 * @text X Movement
 * @type number
 * @desc The horizontal movement while retreating from battle.
 * Default: 300
 * @default 300
 * 
 * @param retreatY
 * @parent retreat
 * @text Y Movement
 * @type number
 * @desc The vertical movement while retreating from battle.
 * Default: 0
 * @default 0
 * 
 * @param retreatDuration
 * @parent retreat
 * @text Duration
 * @type number
 * @desc The amount of frames the retreat animation runs for.
 * Default: 30
 * @default 30
 * 
 */

/*~struct~BattlerPosition:
 *
 * @param parentIndex
 * @text Parent Party Index
 * @type number
 * @desc Set this position relative to another party member's position. -1 means no parent.
 * @min -1
 * @default -1
 * 
 * @param x
 * @text X Coordinate
 * @type number
 * @desc x offset relative to parent.
 * Relative to top left of screen if no parent.
 * @default 0
 * 
 * @param y
 * @text Y Coordinate
 * @type number
 * @desc y offset relative to parent.
 * Relative to top left of screen if no parent.
 * @default 0
 * 
*/

(() => {
    'use strict';

    const script = document.currentScript;
    const parameters = PluginManagerEx.createParameter(script);

    const positions = parameters.positions;

    /**
     * Recursively calculate every party member's position
     * @returns {void}
     */
    function calculateBattlePositions() {

        // avoid visiting the same index twice
        /* this also is a safety check to avoid infinitely recursing
         * if Member A and Member B are marked as parents to each other */
        /* in that situation, the member with the lowest index is given priority */
        /* (i.e. its position is calculated relative to (0,0)) */
        const visited = new Array(positions.length);
        visited.fill(false);

        /**
         * Updates the real x and real y coordinates of the party member that has the index
         * @param {number} index The index of the party member to calculate the position of
         * @returns {void}
         */
        function recursiveCalcPos(index) {

            if (visited[index]) return;

            visited[index] = true;

            const curr = positions[index];
            const parentIndex = curr.parentIndex;

            // no parent, so calculate relative to (0,0)
            if (parentIndex < 0 || parentIndex >= positions.length) {
                curr.realX = curr.x;
                curr.realY = curr.y;
            }
            else {
                // has a parent, so find parent position first
                recursiveCalcPos(parentIndex);
                const parent = positions[parentIndex]
                curr.realX = curr.x + parent.realX;
                curr.realY = curr.y + parent.realY;
            }
        }
        // end recursive function

        for (let index = 0; index < positions.length; index++) {
            recursiveCalcPos(index);
        }
    }

    /* calculate position when battle starts */
    const _startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        calculateBattlePositions();
        _startBattle.apply(BattleManager, arguments);
    };

    // overwrite setActorHome but fall back to original func if actor position wasn't configured in plugin params
    const _setActorHome = Sprite_Actor.prototype.setActorHome;
    Sprite_Actor.prototype.setActorHome = function (index) {

        const position = positions[index];

        if (position) {
            this.setHome(position.realX, position.realY);
        }
        else { // fallback
            _setActorHome.apply(this, arguments);
        }
    };

    // overwrite Sprite_Actor.prototype.retreat if retreat modification is enabled
    if (parameters.retreat) {
        Sprite_Actor.prototype.retreat = function () {
            this.startMove(parameters.retreatX, parameters.retreatY, parameters.retreatDuration);
        };
    }
})();
