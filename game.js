

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
const L = Math.PI*radius/2*45/180;

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

var map = {
    layers: 3,
    cols: 6,
    rows: 10,
    tileMap: {g:10,t:11,s:1,r:3,l:4,v:2,w:0,c:9,m:8,b:7,n:6,c:5},
    tiles: [
        "gtgtgg"+
        "gtgtgg"+
        "gtgggg"+
        "gggggg"+
        "ggttgg"+
        "gggtgg"+
        "gggggg"+
        "gtgggg"+
        "gtgttg"+
        "gtgttg"+
        "gggggg",

        " s s  "+
        " s s  "+
        " s V  "+
        " srs  "+
        " Wss  "+
        " sws  "+
        " sLW  "+
        " s wl "+
        " s ss "+
        " s ss "+
        "      ",

        "      "+
        "      "+
        "   M  "+
        "      "+
        " N    "+
        "  n   "+
        "   N  "+
        "   n  "+
        "      "+
        "      "+
        "      ",
    ],
    getTile: function(layer,x,y)
    {
        var t = this.tiles[layer][x + this.cols*y];
        var rot = (t != t.toLowerCase());
        return [this.tileMap[t.toLowerCase()], rot];
    },
    getTileA: function(layer,x,y)
    {
        return this.tiles[layer][x + this.cols*y];
    },
    setTileA: function(layer,x,y,v)
    {
        this.tiles[layer] = replaceAt(
            this.tiles[layer], x + this.cols*y, v);
    },
    drawTile: function(id, rot, x, y)
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
    },
    draw: function()
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
    },
    getPos: function(at, rel)
    {
        var [x,y] = at;
        var track = this.getTileA(1,x,y);
        var turnout = this.getTileA(2,x,y);
        var tile = (turnout != " ") ? turnout : track;

        var rot = tile != tile.toLowerCase();

        var r = radius;
        var al = (rot ? rel : (1-rel))*Math.PI/4;
        var cy = r*Math.sin(al) * Math.sqrt(2)/1.5;
        //var cx = cy*Math.tan(al) + tileGrid/2;
        var cx = r*(1 - Math.cos(al))*(1.5/Math.sqrt(2))**2 + tileGrid/2;
        maplog.log(`al=${al}, cx=${cx}, cy=${cy}`);

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
                if(!rot) ly = tileGrid - ly;
                break;
            case 'l':
            case 'c':
                lx = tileGrid-cx; ly = cy;
                if(!rot) ly = tileGrid - ly;
                break;
        }
        if(rot)
        {
            lx = tileGrid - lx;
        }

        return [x*tileGrid + lx, y*tileGrid + ly];
    },
    getMove: function(at, rel, dist)
    {
        var [x,y] = at;
        var track = this.getTileA(1,x,y);
        var turnout = this.getTileA(2,x,y);
        if(turnoutCurves.includes( track ) ||
            trackCurves.includes( turnout ) )
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
        }
        return [atnew, rnew];
    },
    getTileFromPixel: function(x,y)
    {
        return [Math.floor(x/tileGrid), Math.floor(y/tileGrid)];
    },
    click: function(x,y)
    {
        var [tx,ty] = this.getTileFromPixel(x,y);
        var t = this.getTileA(2,tx,ty);
        switch(t)
        {
            case 'm': this.setTileA(2,tx,ty,'b'); break;
            case 'n': this.setTileA(2,tx,ty,'c'); break;
            case 'M': this.setTileA(2,tx,ty,'B'); break;
            case 'N': this.setTileA(2,tx,ty,'C'); break;
            case 'b': this.setTileA(2,tx,ty,'m'); break;
            case 'c': this.setTileA(2,tx,ty,'n'); break;
            case 'B': this.setTileA(2,tx,ty,'M'); break;
            case 'C': this.setTileA(2,tx,ty,'N'); break;
        }
    }
};

var carlog = new Log(1000);
class Car {
    constructor(tileId)
    {
        this.tileId = tileId;
        this.tileAt = [1,0];
        this.tileRel = 0.5;
        this.speed = 0;
    }
    draw()
    {
        ctx.save();
        var pos = map.getPos(this.tileAt, this.tileRel);
        ctx.translate(pos[0], pos[1]);
        ctx.drawImage(cartiles, this.tileId%tileN, 
            Math.floor(this.tileId/tileN)*tileGrid,
            tileGrid, tileGrid,
             -tileGrid/2, -tileGrid/2,
             tileGrid, tileGrid);
        ctx.restore();
    }
    move(dt)
    {
        var dist = this.speed*dt/1000;
        [this.tileAt, this.tileRel] = map.getMove(this.tileAt, this.tileRel, dist);

        carlog.log([this.tileAt[0], this.tileAt[1], this.tileRel]);
    }
}

var cars = {
    colors: ["#008080", "#d95600", "#89a02c", "#ab37c8", "#2c5aa0"],
    obj: [new Car(1)],
    lastTime: Date.now(),
    draw: function(ms)
    {
        dt = ms - this.lastTime;
        if(dt < 200)
        {
            for(var o of this.obj)
            {
                o.move(dt);
                o.draw();
            }
        }
        this.lastTime = ms;
    }
};

function speed(inc, fwd)
{
    if(inc)
    {
        if(fwd)
            cars.obj[0].speed = 50;
        else
            cars.obj[0].speed = -50;
    }
    else
    cars.obj[0].speed = 0;
}

function animate()
{
    var ms = Date.now();
    map.draw();
    cars.draw(ms);
    window.requestAnimationFrame(animate);
}

var loaded = 0;
function onload2()
{
    loaded++;
    if(loaded == 2)
        window.requestAnimationFrame(animate);
}

function onload()
{
    canvas = document.getElementById('game');
    ctx = canvas.getContext("2d");

    tiles = new Image();
    tiles.onload = onload2;
    tiles.src = "tiles/railways.png";

    cartiles = new Image();
    cartiles.onload = onload2;
    cartiles.src = "tiles/cars.png";

    canvas.addEventListener("mousedown", function(e)
    {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        map.click(x,y);
    })
}

