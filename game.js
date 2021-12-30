/*
    Shunting Puzzle Game
    Copyright (C) 2021 Christian Carlowitz <chca@cmesh.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var canvas;
var ctx;
var tiles;
var cartiles;

const tileN = 4;
const tileGrid = 64;
const tileBorder = 8;
const tileSize = tileGrid + 2*tileBorder;

const turnoutCurves = ["b","c","B","C"];
const trackCurves = ["r","l","R","L"];
const radius = 1.5*tileGrid;
const L = Math.PI*radius*45/180;
const eps = 1e-3;
const epsCurve = 2;

function replaceAt(s,i,c)
{
    return s.substr(0,i) + c + s.substr(i+1);
}


class Log {
    constructor(interval)
    {
        this.lastlog = 0;
        this.interval = interval;
    }
    log(arg)
    {
        if(Date.now()>(this.lastlog+this.interval))
        {
            console.log(arg);
            this.lastlog = Date.now();
        }
    }
}


var maplog = new Log(1000);

class TileMap {
    constructor()
    {
        this.layers = 0;
        this.cols = 0;
        this.rows = 0;
        this.tileMap = {g:10,t:11,s:1,r:3,l:4,v:2,w:0,c:9,m:8,b:7,n:6,c:5};
        this.tiles = [];
    }
    setTileMap(data)
    {
        for(var level of data["level"])
        {
            var str = "";
            for(var s of level)
                str += s;
            this.tiles.push(str);
        }
        this.layers = data["layers"];
        this.cols = data["cols"];
        this.rows = data["rows"];
    }
    getTile(layer,x,y)
    {
        var t = this.tiles[layer][x + this.cols*y];
        var rot = (t != t.toLowerCase());
        return [this.tileMap[t.toLowerCase()], rot];
    }
    getTileA(layer,x,y)
    {
        return this.tiles[layer][x + this.cols*y];
    }
    setTileA(layer,x,y,v)
    {
        this.tiles[layer] = replaceAt(
            this.tiles[layer], x + this.cols*y, v);
    }
    drawTile(id, rot, x, y)
    {
        ctx.save();
        ctx.translate(
            tileSize/2 + Math.floor(x * tileGrid - tileBorder),
            tileSize/2 + Math.floor(y * tileGrid - tileBorder));
        if(rot)
            ctx.rotate(Math.PI);
        ctx.drawImage(
          tiles,
          (id%tileN)*tileSize, Math.floor(id/tileN)*tileSize,
          tileSize, tileSize,
          -tileSize/2, -tileSize/2,
          tileSize, tileSize
        );
        ctx.restore();
    }
    draw()
    {
        for(var l=0; l < this.layers; l++)
        {
            for(var col=0; col < this.cols; col++)
            {
                for(var row=0; row < this.rows; row++)
                {
                    var [tile,rot] = this.getTile(l,col,row);
                    this.drawTile(tile, rot, col, row);
                }
            }
        }
    }
    getPos(at, rel)
    {
        var [x,y] = at;
        var track = this.getTileA(1,x,y);
        if(!logic.checkTrack(track))
            return [[0,0],0];
        var turnout = this.getTileA(2,x,y);
        var tile = (turnout != " ") ? turnout : track;

        var rot = tile != tile.toLowerCase();

        var r = radius;
        var al = (rot ? rel : (1-rel))*Math.PI/4;
        var cy = r*Math.sin(al) * Math.sqrt(2)/1.5;
        var cx = r*(1 - Math.cos(al))*(1.5/Math.sqrt(2))**2 + tileGrid/2;
        var angle = 0;
        //maplog.log(`al=${al}, cx=${cx}, cy=${cy}`);

        var lx = 0; // tile-local x
        var ly = 0; // tile-local y
        switch(tile.toLowerCase())
        {
            case 's':
            case 'm':
            case 'n':
                lx = tileGrid/2; ly = rel*tileGrid; break;
            case 'r':
            case 'b':
                lx = cx; ly = cy;
                if(!rot)
                {
                    ly = tileGrid - ly;
                    angle = (1-rel)*45/180*Math.PI;
                }
                else
                {
                    angle = rel*45/180*Math.PI;
                }
                break;
            case 'l':
            case 'c':
                lx = tileGrid-cx; ly = cy;
                if(!rot)
                {
                    ly = tileGrid - ly;
                    angle = -(1-rel)*45/180*Math.PI;
                }
                else
                {
                    angle = -rel*45/180*Math.PI;
                }
                
                break;
        }
        if(rot)
        {
            lx = tileGrid - lx;
        }

        return [[x*tileGrid + lx, y*tileGrid + ly],angle];
    }
    getMove(at, rel, dist, sim=false)
    {
        var [x,y] = at;
        var track = this.getTileA(1,x,y);
        var turnout = this.getTileA(2,x,y);
        if(turnoutCurves.includes( turnout ) ||
            trackCurves.includes( track ) )
        {
            var rnew = rel+(dist/tileGrid/(L/tileGrid));
        }
        else
        {
            var rnew = rel+(dist/tileGrid);
        }

        var atnew = at;

        if((rnew > 1) || (rnew < 0))
        {
            var fac = (rnew > 1) ? 1 : -1;
            var rot = ((track != track.toLowerCase()) || 
                (turnout != turnout.toLowerCase())) ? -1 : 1;

            switch(track.toLowerCase())
            {
                case 's': atnew = [at[0],at[1]+fac]; break;
                case 'r': atnew = [at[0]+rot,at[1]+fac]; break;
                case 'l': atnew = [at[0]-rot,at[1]+fac]; break;
            }
            switch(turnout.toLowerCase())
            {
                case 'm': atnew = [at[0],at[1]+fac]; break;
                case 'n': atnew = [at[0],at[1]+fac]; break;
                case 'b': atnew = [at[0]+rot,at[1]+fac]; break;
                case 'c': atnew = [at[0]-rot,at[1]+fac]; break;
            }
            if((fac>0 && rot>0) || (fac<1 && rot<0))
                atnew[0] = at[0];
            rnew -= fac*1;

            if(!sim)
                logic.checkRailTransistion(at,rel,atnew,rnew);
        }
        return [atnew, rnew];
    }
    getTileFromPixel(x,y)
    {
        return [Math.floor(x/tileGrid), Math.floor(y/tileGrid)];
    }
    click(x,y)
    {
        var [tx,ty] = this.getTileFromPixel(x,y);

        var t = this.getTileA(2,tx,ty);
        var sw = false;
        switch(t)
        {
            case 'm': this.setTileA(2,tx,ty,'b'); sw=true; break;
            case 'n': this.setTileA(2,tx,ty,'c'); sw=true; break;
            case 'M': this.setTileA(2,tx,ty,'B'); sw=true; break;
            case 'N': this.setTileA(2,tx,ty,'C'); sw=true; break;
            case 'b': this.setTileA(2,tx,ty,'m'); sw=true; break;
            case 'c': this.setTileA(2,tx,ty,'n'); sw=true; break;
            case 'B': this.setTileA(2,tx,ty,'M'); sw=true; break;
            case 'C': this.setTileA(2,tx,ty,'N'); sw=true; break;
        }
        if(sw)
        {
            if(logic.checkCarOnTurnout(tx,ty))
                this.setTileA(2,tx,ty,t);
        }
    }
};
var map = new TileMap();

var carlog = new Log(1000);
class Car {
    constructor(tileId, initX, initY)
    {
        this.tileId = tileId;
        this.tileAt = [initX,initY];
        this.tileAtLast = [initX,initY];
        this.tileRel = 0.5;
        this.tileRelLast = 0.5;
        this.pos = [0,0];
        this.angle = 0;
        this.speed = 0;
        this.attached = [];
    }
    draw()
    {
        ctx.save();
        // draw couplers between cars
        ctx.strokeStyle = "rgb(100,100,100)";
        ctx.lineWidth = 4;
        var objAbove = this.attached.filter(o => o.pos[1]<this.pos[1]);
        objAbove.reverse();
        var objBelow = this.attached.filter(o => o.pos[1]>this.pos[1]);
        ctx.beginPath();
        ctx.moveTo(this.pos[0], this.pos[1])
        for(var o of objAbove)
            ctx.lineTo(o.pos[0], o.pos[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.pos[0], this.pos[1])
        for(var o of objBelow)
            ctx.lineTo(o.pos[0], o.pos[1]);
        ctx.stroke();
        // draw car
        [this.pos, this.angle] = map.getPos(this.tileAt, this.tileRel);
        ctx.translate(this.pos[0], this.pos[1]);
        ctx.rotate(this.angle);
        ctx.drawImage(cartiles, this.tileId%tileN*tileGrid, 
            Math.floor(this.tileId/tileN)*tileGrid,
            tileGrid, tileGrid,
             -tileGrid/2, -tileGrid/2,
             tileGrid, tileGrid);
        ctx.restore();
        // draw attached cars
        for(var o of this.attached)
            o.draw();
    }
    moveD(dist)
    {
		[this.tileAtLast, this.tileRelLast] = [this.tileAt, this.tileRel];
        [this.tileAt, this.tileRel] = map.getMove(this.tileAt, this.tileRel, dist);
        for(var o of this.attached)
            o.moveD(dist);
    }
    move(dt)
    {
        var dist = this.speed*dt/1000;
        [this.tileAtLast, this.tileRelLast] = [this.tileAt, this.tileRel];
        [this.tileAt, this.tileRel] = map.getMove(this.tileAt, this.tileRel, dist);
        for(var o of this.attached)
            o.move(dt);
        //carlog.log([this.tileAt[0], this.tileAt[1], this.tileRel]);
    }
    revertMove()
    {
        [this.tileAt, this.tileRel] = [this.tileAtLast, this.tileRelLast];
        this.speed = 0;
    }
    syncAttached()
    {
        // sync speed of attached cars
        for(var o of this.attached)
            o.speed = this.speed;
        // sort attached cars
        this.attached.sort((a,b) => a.pos[1] - b.pos[1]);
    }
    uncouple(w)
    {
        if(w.speed > eps)
            return;
        this.syncAttached();
        var idx = this.attached.indexOf(w);
        var posUp = w.pos[1] < this.pos[1];
        var uncouple;
        if(posUp)
            uncouple = this.attached.slice(0,idx+1);
        else
            uncouple = this.attached.slice(idx);
        for(var o of uncouple)
        {
            this.attached.splice(this.attached.indexOf(o),1);
            o.moveD( (posUp ? -1 : 1)*tileGrid/10 );
        }
        return uncouple;
    }
}

function vdiff(v1,v2) { return [v1[0]-v2[0], v1[1]-v2[1]]; }
function vlen(v) { return Math.sqrt(v[0]**2 + v[1]**2); }
function vdist(v1,v2) { return vlen(vdiff(v1,v2)); }

class CarManager
{
    constructor()
    {
        this.wagons = [];
        this.engine = null;
    }
    load(data)
    {
        var e = data.engine;
        this.engine = new Car(e.id, e.x, e.y);
        for(var w of data.cars)
            this.wagons.push( new Car(w.id, w.x, w.y) );
    }
    getAllWagons() // parked or in train, but not engine
    {
        return this.engine.attached.concat(this.wagons);
    }
    revert()
    {
        this.engine.revertMove();
        for(var w of this.getAllWagons())
            w.revertMove();
    }
    draw(dt)
    {
        if(dt < 200)
        {
            this.engine.syncAttached();
            this.engine.move(dt);
            this.engine.draw();
            for(var o of this.wagons)
                o.draw();

            // collision detection
            var obj = [this.engine].concat(this.engine.attached);
            for(var trainCar of obj)
            {
                for(var otherCar of this.wagons)
                {
                    if( (vlen(vdiff(trainCar.pos, otherCar.pos))
                        < tileGrid) )
                    {
                        var nextTile = map.getMove(
                            trainCar.tileAt, trainCar.tileRel,
                            trainCar.speed < 0 ? -tileGrid:tileGrid,
                            true)[0]
                        if((nextTile[0] == otherCar.tileAt[0])
                            && (nextTile[1] == otherCar.tileAt[1]))
                        {
                            this.engine.attached.push(otherCar);
                            this.wagons.splice(this.wagons.indexOf(otherCar),1);
                        }
                    }
                }
            }
        }
    }
    click(x,y)
    {
        for(var w of this.engine.attached)
        {
            var dist = vdist([x,y], w.pos);
            if(dist < tileGrid/2)
            {
                var uncoupled = this.engine.uncouple(w);
                if(uncoupled)
                {
                    for(var o of uncoupled)
                        this.wagons.push(o);
                    logic.countMove();
                }
            }
        }
    }
};
var cars = new CarManager();

class Cab {
    constructor()
    {
        this.throttle = "none";
        this.speed = 0;
    }
    throttleUp() { this.throttle = "up"; }
    throttleDn() { this.throttle = "down"; }
    throttleIdle() { this.throttle = "none"; }
    animate()
    {
        switch(this.throttle)
        {
            case "none":
                this.speed = 0;
                break;
            case "up":
                this.speed = -100;
                break;
            case "down":
                this.speed = 100;
                break;
        }
        cars.engine.speed = this.speed;
    }
    stop()
    {
        this.throttle = "none";
        this.animate();
    }
};
var cab = new Cab();

class GameLogic
{
    constructor()
    {
        this.goal = new Map();
        this.carcolors = [];

        this.time = 0;
        this.startTime = 0;
        this.running = true;
        this.moves = 0;
        this.badge = "";

        this.moveError = false;
    }
    load(data)
    {
        for(var g of data.goal)
            this.goal.set(g.id, [g.x,g.y]);
        this.carcolors = data.carcolors;
        if("badge" in data)
            this.badge = data.badge;
    }
    timer()
    {
        if(!this.running)
            return;
        if(this.startTime == 0)
            this.startTime = Date.now();
        var now = Date.now();
        var time = Math.floor((now - this.startTime)/1000);
        if(time > this.time)
        {
            this.time = time;
            $("#time").html(
                sprintf("%d:%02d", Math.floor(time/60), time%60)
            );
            $("#moves").html( this.moves.toString() );
        }
    }
    countMove()
    {
        if(!this.running)
            return;
        this.moves += 1;
    }
    draw()
    {
        for(var [id,xy] of this.goal)
        {
            ctx.fillStyle = this.carcolors[id];
            ctx.beginPath();
            var x = xy[0]*tileGrid+7*tileGrid/8;
            var y = xy[1]*tileGrid+tileGrid/2;
            var r = tileGrid/10;
            ctx.arc(x, y - r, r, 0, Math.PI*2, false);
            ctx.fill();
            ctx.fillStyle = "#01022a";
            ctx.textAlign = "center";
            ctx.font = "16px Montserrat, bold";
            ctx.fillText(id.toString(), x, y + 3*r);
        }
    }
    check()
    {
        if(!this.running)
            return;
        var err = false;
        // check for victory condition
        for(var c of cars.getAllWagons())
        {
            if(this.goal.has(c.tileId))
            {
                var dest = this.goal.get(c.tileId);
                if((c.tileAt[0] != dest[0]) ||
                    (c.tileAt[1] != dest[1]))
                    err = true;
            }
        }
        // victory only when all wagons parked
        if(cars.engine.attached.length != 0)
            err = true;
        // check for cars placed on invalid tiles
        for(var c of cars.wagons)
        {
            var [t,rot] = map.getTileA(0,c.tileAt[0],c.tileAt[1]);
            if(t != "t")
            {
                this.moveError = true;
                err = true;
            }
        }
        if(!err)
        {
            var b = "";
            if(this.badge)
                b += "Your badge: " + this.badge;
            alert("congratulations, you're done! " + b);
            this.running = false;
        }
    }
    cleanup()
    {
        if(this.moveError)
        {
            alert("invalid operation, retry.");
            cab.stop();
            cars.revert();
            map.draw();
            cars.draw(0);
            logic.draw();
            this.moveError = false;
        }
    }
    checkCarOnTurnout(tx,ty)
    {
        var obj = [cars.engine].concat(cars.wagons)
            .concat(cars.engine.attached);
        for(var o of obj)
        {
            if((o.tileAt[0] == tx) && (o.tileAt[1] == ty))
            {
                this.moveError = true;
                return true;
            }
        }
        return false;
    }
    checkRailTransistion(at,r,atnew,rnew)
    {
        r = Math.round(r);
        rnew = Math.round(rnew);
        var posOld = map.getPos(at,r)[0];
        var posNew = map.getPos(atnew,rnew)[0];
        if(vdist(posOld, posNew) > epsCurve)
            this.moveError = true;
    }
    checkTrack(t)
    {
        if(!t || t==" ")
        {
            this.moveError = true;
            return false;
        }
        return true;
    }
};
var logic = new GameLogic();

var lastTime = Date.now();
function animate()
{
    var ms = Date.now();
    var dt = ms - lastTime;
    lastTime = ms;
    if(dt > 200)
    {
        window.requestAnimationFrame(animate);
        return;
    }
    map.draw();
    cab.animate();
    cars.draw(dt);
    logic.draw();
    logic.check();
    logic.cleanup();
    logic.timer(ms);
    window.requestAnimationFrame(animate);
}

var loaded = 0;
function onload2()
{
    loaded++;
    if(loaded == 3)
        window.requestAnimationFrame(animate);
}

function onload()
{
    canvas = document.getElementById('game');
    ctx = canvas.getContext("2d");

    // load #1
    tiles = new Image();
    tiles.onload = onload2;
    tiles.src = "tiles/railways.png";
    // load #2
    cartiles = new Image();
    cartiles.onload = onload2;
    cartiles.src = "tiles/cars.png";
    // load #3
    var params = new URLSearchParams(location.search);
    var level = params.get("level");
    fetch("level_" + level + ".json")
        .then(response => response.json())
        .then(function(data)
    {
        map.setTileMap(data);
        cars.load(data);
        logic.load(data);
        $("#name").html( data.name );
        canvas.height = data.rows * tileGrid;
        canvas.width = data.cols * tileGrid;
        onload2();
    });

    // Keyboard and Mouse I/O
    canvas.addEventListener("mousedown", function(e)
    {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        map.click(x,y);
        cars.click(x,y);
    })

    document.addEventListener("keydown", function(e)
    {
        switch(e.key)
        {
            case "w": cab.throttleUp(); break;
            case "s": cab.throttleDn(); break;
        }
    }, false);

    document.addEventListener("keyup", function(e)
    {
        switch(e.key)
        {
			case "w":
			case "s":
				cab.throttleIdle(); break;
        }
    }, false);

}

